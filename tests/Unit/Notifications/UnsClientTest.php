<?php

namespace Tests\Unit\Notifications;

use App\Services\Notifications\UnsClient;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class UnsClientTest extends TestCase
{
    public function test_it_accepts_202_response_as_success(): void
    {
        Config::set('services.notification_service.base_url', 'https://uns.test');
        Config::set('services.notification_service.timeout', 10);
        Config::set('services.notification_service.internal_api_key', 'secret-key');

        Http::fake([
            'https://uns.test/v1/notifications' => Http::response(['ok' => true], 202),
        ]);

        $payload = [
            'event' => 'CRM_EMAIL',
            'userId' => 1,
            'channels' => ['email'],
            'idempotencyKey' => 'id-1',
        ];

        $result = app(UnsClient::class)->send($payload);

        $this->assertTrue($result);
        Http::assertSent(function ($request) use ($payload) {
            return $request->url() === 'https://uns.test/v1/notifications'
                && $request->hasHeader('X-Internal-API-Key', 'secret-key')
                && $request['event'] === $payload['event'];
        });
    }

    public function test_it_treats_409_as_success_for_idempotent_retries(): void
    {
        Config::set('services.notification_service.base_url', 'https://uns.test');

        Http::fake([
            'https://uns.test/v1/notifications' => Http::response(['error' => 'duplicate'], 409),
        ]);

        $result = app(UnsClient::class)->send([
            'event' => 'CRM_EMAIL',
            'userId' => 1,
            'channels' => ['email'],
            'idempotencyKey' => 'id-duplicate',
        ]);

        $this->assertTrue($result);
    }
}
