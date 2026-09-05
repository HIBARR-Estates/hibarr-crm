<?php

namespace Tests\Feature\Deals;

use App\Http\Controllers\Api\DealContactApiController;
use App\Http\Requests\Deal\CreateDealRequest;
use App\Jobs\ProcessDealRequestJob;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The deal API is called repeatedly by the marketing integration, sometimes with
 * a byte-identical payload seconds apart. Those repeats must be absorbed silently
 * (200 + contact id, no processing), while a genuinely different follow-up push -
 * typically the one carrying the meeting - must still go through.
 */
class DealRequestDuplicateWindowTest extends TestCase
{
    private const WINDOW = 60;

    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Cache::flush();
    }

    public function test_identical_request_inside_window_is_ignored_and_returns_contact_id(): void
    {
        Bus::fake();

        $payload = $this->payload();
        $key = $this->keyFor($payload);

        // Stand in for a first request that already resolved this contact.
        Cache::put($key, 8610, self::WINDOW);

        $response = (new DealContactApiController)->createDeal($this->request($payload));
        $body = $response->getData(true);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('accepted', $body['status']);
        $this->assertTrue($body['duplicate']);
        $this->assertSame(8610, $body['contact_id']);

        Bus::assertNotDispatchedSync(ProcessDealRequestJob::class);
    }

    public function test_duplicate_of_an_in_flight_request_falls_back_to_the_payload_lead_id(): void
    {
        Bus::fake();

        $payload = $this->payload(['lead_id' => 8610]);
        $key = $this->keyFor($payload);

        // Reservation exists but the contact id has not been recorded yet.
        Cache::put($key, true, self::WINDOW);

        $body = (new DealContactApiController)->createDeal($this->request($payload))->getData(true);

        $this->assertTrue($body['duplicate']);
        $this->assertSame(8610, $body['contact_id']);

        Bus::assertNotDispatchedSync(ProcessDealRequestJob::class);
    }

    public function test_window_expires_after_sixty_seconds(): void
    {
        $key = $this->keyFor($this->payload());

        $this->assertTrue($this->reserve($key), 'first request should claim the window');
        $this->assertFalse($this->reserve($key), 'repeat inside the window is a duplicate');

        $this->travel(self::WINDOW + 1)->seconds();

        $this->assertTrue($this->reserve($key), 'the same payload is processed again after the window');
    }

    public function test_a_follow_up_push_carrying_a_meeting_is_not_a_duplicate(): void
    {
        $withoutMeeting = $this->payload();
        $withMeeting = $this->payload([
            'meeting' => [
                'meeting_date' => '2026-09-10 11:00:00',
                'meeting_type' => 'Zoom',
            ],
        ]);

        $this->assertNotSame(
            $this->keyFor($withoutMeeting),
            $this->keyFor($withMeeting),
            'adding a meeting must produce a different request, not a suppressed duplicate'
        );
    }

    /**
     * @dataProvider distinguishingFields
     */
    public function test_fingerprint_is_sensitive_to_each_significant_field(array $override): void
    {
        $this->assertNotSame(
            $this->keyFor($this->payload()),
            $this->keyFor($this->payload($override)),
            'a change to a fingerprinted field must not be treated as a duplicate'
        );
    }

    public static function distinguishingFields(): array
    {
        return [
            'deal name' => [['deal_name' => 'Ayomide+Oluniyi HIbarr']],
            'email' => [['email' => 'someone.else@hibarr.de']],
            'lead id' => [['lead_id' => 999]],
            'deal owner' => [['deal_owner_id' => '7']],
            'packages' => [['package_id' => [3]]],
            'package name' => [['package_name' => 'Gold']],
        ];
    }

    public function test_fingerprint_ignores_key_order_and_email_casing(): void
    {
        $a = $this->keyFor([
            'email' => 'paradox@hibarr.de',
            'deal_name' => 'Ayomide Oluniyi',
            'deal_owner_id' => '3',
        ]);

        $b = $this->keyFor([
            'deal_owner_id' => '3',
            'deal_name' => 'Ayomide Oluniyi',
            'email' => 'PARADOX@hibarr.de',
        ]);

        $this->assertSame($a, $b);
    }

    public function test_fingerprint_ignores_fields_outside_the_identity_set(): void
    {
        $this->assertSame(
            $this->keyFor($this->payload()),
            $this->keyFor($this->payload(['utm_source' => 'facebook', 'phone' => '+491234'])),
            'noise fields must not defeat duplicate detection'
        );
    }

    public function test_a_failed_request_releases_the_window_so_a_retry_is_processed(): void
    {
        // No schema is created, so resolving the contact raises - the same shape as
        // any mid-request failure. The reservation must not outlive the failure.
        $payload = $this->payload();
        $key = $this->keyFor($payload);

        $response = (new DealContactApiController)->createDeal($this->request($payload));

        $this->assertIsArray($response, 'the failure path returns Reply::error()');
        $this->assertSame('fail', $response['status']);
        $this->assertTrue($this->reserve($key), 'a retry after a failure must not be swallowed as a duplicate');
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'email' => 'paradox@hibarr.de',
            'name' => 'Ayomide Oluniyi',
            'deal_name' => 'Ayomide Oluniyi',
            'deal_owner_id' => '3',
            'update_agent_if_exists' => '1',
        ], $overrides);
    }

    private function request(array $payload): CreateDealRequest
    {
        $request = CreateDealRequest::create('/api/deal/create', 'POST', $payload);
        $request->headers->set('X-COMPANY-ID', (string) $this->companyId);

        return $request;
    }

    private function keyFor(array $payload): string
    {
        $method = new \ReflectionMethod(DealContactApiController::class, 'duplicateRequestKey');
        $method->setAccessible(true);

        return $method->invoke(new DealContactApiController, $this->request($payload), $this->companyId);
    }

    private function reserve(string $key): bool
    {
        $method = new \ReflectionMethod(DealContactApiController::class, 'reserveRequest');
        $method->setAccessible(true);

        return $method->invoke(new DealContactApiController, $key);
    }
}
