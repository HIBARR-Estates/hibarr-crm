<?php

namespace App\Services\Notifications;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class UnsClient
{
    private string $baseUrl;
    private int $timeout;
    private ?string $internalApiKey;

    public function __construct()
    {
        $this->baseUrl = rtrim((string) config('services.notification_service.base_url', ''), '/');
        $this->timeout = (int) config('services.notification_service.timeout', 15);
        $apiKey = config('services.notification_service.internal_api_key');
        $this->internalApiKey = is_string($apiKey) && trim($apiKey) !== '' ? trim($apiKey) : null;
    }

    /**
     * @param array<string, mixed> $payload
     */
    public function send(array $payload): bool
    {
        if ($this->baseUrl === '') {
            Log::error('UNS email routing failed: Notification service base URL is not configured.');

            return false;
        }

        $request = Http::timeout($this->timeout);

        if ($this->internalApiKey !== null) {
            $request = $request->withHeaders([
                'X-Internal-API-Key' => $this->internalApiKey,
            ]);
        }

        try {
            $response = $request->post($this->baseUrl . '/v1/notifications', $payload);
        } catch (\Throwable $exception) {
            Log::error('UNS email routing failed: request exception.', [
                'error' => $exception->getMessage(),
            ]);

            return false;
        }

        Log::debug('UNS request sent.', [
            'status' => $response->status(),
            'payload' => $payload,
            'response' => $response->body(),
        ]);

        if (in_array($response->status(), [200, 202, 409], true)) {
            return true;
        }

        Log::error('UNS email routing failed: non-success response.', [
            'status' => $response->status(),
            'response' => $response->body(),
        ]);

        return false;
    }
}
