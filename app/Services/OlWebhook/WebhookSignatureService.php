<?php

namespace App\Services\OlWebhook;

class WebhookSignatureService
{
    public function sign(string $payload, string $timestamp, string $secret): string
    {
        return hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);
    }
}

