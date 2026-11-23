<?php

namespace Tests\Unit\Services\Suppression;

use App\Models\User;
use App\Services\Suppression\SuppressionManagementClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SuppressionManagementClientTest extends TestCase
{
    public function test_entity_restrictions_sends_acting_crm_user_headers_and_api_key(): void
    {
        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Config::set('services.ol.api_key', 'ol-secret');

        Http::fake([
            'https://ol.test/v1/suppression-restrictions/lead/42' => Http::response([
                'success' => true,
                'data' => [
                    'restrictions' => [
                        [
                            'uuid' => 'supp-1',
                            'channel' => 'email',
                            'scope' => 'non_transactional',
                            'reason' => 'unsubscribed',
                            'source' => 'unsubscribe_link',
                            'author' => null,
                            'createdAt' => '2026-11-20T10:00:00Z',
                            'expiresAt' => null,
                            'applyToFutureDetails' => false,
                            'email' => 'a***@example.com',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $actor = new User;
        $actor->id = 77;
        $actor->name = 'Agent Smith';

        $result = (new SuppressionManagementClient)->getEntityRestrictions('lead', 42, $actor);

        $this->assertFalse($result['unavailable']);
        $this->assertCount(1, $result['restrictions']);

        Http::assertSent(function (Request $request): bool {
            return $request->url() === 'https://ol.test/v1/suppression-restrictions/lead/42'
                && $request->hasHeader('X-Api-Key', 'ol-secret')
                && $request->hasHeader('x-crm-user-id', '77')
                && $request->hasHeader('x-crm-user-name', 'Agent Smith');
        });
    }

    public function test_lookup_returns_unavailable_when_ol_is_unconfigured_or_errors(): void
    {
        Config::set('services.ol.base_url', '');
        Config::set('services.ol.api_key', '');

        $actor = new User;
        $actor->id = 12;
        $actor->name = 'CRM User';

        $result = (new SuppressionManagementClient)->getEntityRestrictions('deal', 99, $actor);

        $this->assertTrue($result['unavailable']);
        $this->assertSame([], $result['restrictions']);

        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Config::set('services.ol.api_key', 'ol-secret');
        Http::fake([
            'https://ol.test/v1/suppression-restrictions*' => Http::response([], 503),
        ]);

        $handleResult = (new SuppressionManagementClient)->getHandleRestrictions('user@example.com', 'email', $actor);

        $this->assertTrue($handleResult['unavailable']);
        $this->assertSame([], $handleResult['restrictions']);
    }

    public function test_block_and_lift_forward_acting_crm_user_headers(): void
    {
        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Config::set('services.ol.api_key', 'ol-secret');

        Http::fake([
            'https://ol.test/v1/suppressions' => Http::response([
                'success' => true,
                'message' => 'Created',
                'data' => ['entries' => [['uuid' => 'new-uuid']]],
            ], 201),
            'https://ol.test/v1/suppressions/new-uuid/lift' => Http::response([
                'success' => true,
                'message' => 'Lifted',
                'data' => ['entry' => ['uuid' => 'new-uuid']],
            ], 200),
        ]);

        $actor = new User;
        $actor->id = 55;
        $actor->name = 'Manager Jane';

        $client = new SuppressionManagementClient;

        $block = $client->block([
            'entityType' => 'lead',
            'entityId' => 42,
            'channels' => ['email'],
            'scope' => 'non_transactional',
            'reason' => 'manual',
            'applyToFutureDetails' => true,
        ], $actor);

        $this->assertTrue($block['ok']);
        $this->assertSame(201, $block['status']);

        $lift = $client->lift('new-uuid', [
            'reason' => 'Confirmed with customer',
            'consentEvidence' => ['text' => 'Signed new form'],
        ], $actor);

        $this->assertTrue($lift['ok']);
        $this->assertSame(200, $lift['status']);

        Http::assertSentCount(2);
    }
}
