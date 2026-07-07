<?php

namespace App\Services\OlWebhook;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class OlWebhookClient
{
    public function send(array $payload, string $timestamp, string $signature): Response
    {
        $endpoint = (string) config('services.ol_webhook.endpoint', '');
        $timeout = (int) config('services.ol_webhook.timeout', 10);

        return Http::timeout($timeout)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'X-Webhook-Timestamp' => $timestamp,
                'X-Webhook-Signature' => $signature,
                'X-Idempotency-Key' => (string) ($payload['eventId'] ?? ''),
            ])
            ->post($endpoint, $payload);
    }
}

