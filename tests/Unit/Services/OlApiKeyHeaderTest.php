<?php

namespace Tests\Unit\Services;

use App\Services\CalendarSyncService;
use App\Services\OlTelephonyProxyService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * OL resolves the calling application by an exact match on the x-api-key
 * header. Setting it under two casings ('x-api-key' and 'X-Api-Key') makes
 * Guzzle merge them into one header with two values, which OL (Node) reads as
 * "<key>, <key>" and rejects with "Invalid API key".
 */
class OlApiKeyHeaderTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.ol.base_url', 'https://ol.test/v1');
        config()->set('services.ol.api_key', 'ol-test-key');
        config()->set('services.ol.timeout', 5);
    }

    public function test_calendar_sync_sends_the_api_key_once(): void
    {
        Http::fake([
            'https://ol.test/v1/crm/events/jobs/job-1/retry' => Http::response(['data' => ['jobId' => 'job-2']], 202),
        ]);

        app(CalendarSyncService::class)->retryEvent('job-1');

        $this->assertApiKeySentOnce();
    }

    public function test_telephony_proxy_sends_the_api_key_once(): void
    {
        Http::fake([
            'https://ol.test/v1/telephony/calls' => Http::response(['data' => [], 'message' => 'ok'], 200),
        ]);

        app(OlTelephonyProxyService::class)->initiateCall([
            'phone_number' => '+4915112345678',
            'entity_type' => 'lead',
            'entity_id' => 1,
            'user_id' => 1,
        ]);

        $this->assertApiKeySentOnce();
    }

    private function assertApiKeySentOnce(): void
    {
        Http::assertSentCount(1);
        Http::assertSent(function (Request $request): bool {
            $this->assertSame(['ol-test-key'], $request->header('x-api-key'));

            return true;
        });
    }
}
