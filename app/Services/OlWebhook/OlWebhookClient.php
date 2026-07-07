<?php

namespace App\Services\OlWebhook;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class OlWebhookClient
{
    public function send(array $payload, string $apiKey, string $apiKeyHeader): Response
    {
        $endpoint = (string) config('services.ol_webhook.endpoint', '');
        $timeout = (int) config('services.ol_webhook.timeout', 10);

        return Http::timeout($timeout)
            ->withHeaders([
                'Content-Type' => 'application/json',
                $apiKeyHeader => $apiKey,
                'X-Idempotency-Key' => (string) ($payload['eventId'] ?? ''),
            ])
            ->post($endpoint, $payload);
    }
}

