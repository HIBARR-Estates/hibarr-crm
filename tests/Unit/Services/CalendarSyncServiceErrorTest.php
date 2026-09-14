<?php

namespace Tests\Unit\Services;

use App\Services\CalendarSyncService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CalendarSyncServiceErrorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);
    }

    public function test_last_error_carries_ol_validation_details(): void
    {
        Http::fake([
            'https://ol.test/v1/crm/events/jobs/job-1/retry' => Http::response([
                'message' => 'Validation error.',
                'data' => ['error' => [['field' => 'timezone', 'message' => '"timezone" is required']]],
            ], 400),
        ]);

        $service = app(CalendarSyncService::class);

        $this->assertNull($service->retryEvent('job-1'));
        $this->assertSame(
            ['code' => '400', 'message' => 'Validation error: "timezone" is required'],
            $service->lastError()
        );
    }

    public function test_last_error_uses_plain_message_without_details(): void
    {
        Http::fake([
            'https://ol.test/v1/crm/events/jobs/job-2/retry' => Http::response(['message' => 'No linked OL user'], 404),
        ]);

        $service = app(CalendarSyncService::class);

        $this->assertNull($service->retryEvent('job-2'));
        $this->assertSame('No linked OL user', $service->lastError()['message'] ?? null);
    }

    public function test_last_error_is_cleared_by_a_successful_call(): void
    {
        Http::fakeSequence('https://ol.test/v1/crm/events/jobs/job-3/retry')
            ->push(['message' => 'Boom'], 500)
            ->push(['data' => ['jobId' => 'job-4']], 202);

        $service = app(CalendarSyncService::class);

        $this->assertNull($service->retryEvent('job-3'));
        $this->assertNotNull($service->lastError());

        $this->assertSame('job-4', $service->retryEvent('job-3'));
        $this->assertNull($service->lastError());
    }
}
