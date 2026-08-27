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
     * @param  array<string, mixed>  $payload
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
            $response = $request->post($this->baseUrl.'/v1/notifications', $payload);
        } catch (\Throwable $exception) {
            Log::error('UNS email routing failed: request exception.', [
                'error' => $exception->getMessage(),
            ]);

            return false;
        }

        if (in_array($response->status(), [200, 202, 409], true)) {
            Log::info('UNS email routing accepted.', [
                'status' => $response->status(),
                'idempotencyKey' => $payload['idempotencyKey'] ?? null,
                'notificationId' => $response->json('notificationId'),
                'unsStatus' => $response->json('status'),
                'response' => $response->status() === 202 ? null : $response->body(),
            ]);

            return true;
        }

        Log::error('UNS email routing failed: non-success response.', [
            'status' => $response->status(),
            'response' => $response->body(),
        ]);

        return false;
    }

    /**
     * List the Plunk email templates UNS knows about, for the "pick a Plunk
     * template" dropdown on Email Templates. Normalized to
     * [['id' => ..., 'name' => ...], ...] — the endpoint's exact response
     * shape isn't documented here, so this tries several plausible id/name
     * key names and several plausible wrapper shapes (bare array, or an
     * array under 'data'/'templates'). Returns [] on any failure so the
     * caller can fall back to manual entry — never throws.
     *
     * @return array<int, array{id: string, name: string}>
     */
    public function listEmailTemplates(): array
    {
        if ($this->baseUrl === '') {
            Log::warning('UNS listEmailTemplates skipped: Notification service base URL is not configured.');

            return [];
        }

        $request = Http::timeout($this->timeout);

        if ($this->internalApiKey !== null) {
            $request = $request->withHeaders([
                'X-Internal-API-Key' => $this->internalApiKey,
            ]);
        }

        try {
            $response = $request->get($this->baseUrl.'/v1/email/templates');
        } catch (\Throwable $exception) {
            Log::error('UNS listEmailTemplates failed: request exception.', [
                'error' => $exception->getMessage(),
            ]);

            return [];
        }

        if (! $response->successful()) {
            Log::error('UNS listEmailTemplates failed: non-success response.', [
                'status' => $response->status(),
                'response' => $response->body(),
            ]);

            return [];
        }

        $payload = $response->json();
        $list = $payload['data'] ?? $payload['templates'] ?? $payload;

        if (! is_array($list)) {
            return [];
        }

        $templates = [];

        foreach ($list as $item) {
            if (! is_array($item)) {
                continue;
            }

            $id = $item['id'] ?? $item['templateId'] ?? $item['template_id'] ?? $item['slug'] ?? null;

            if ($id === null || $id === '') {
                continue;
            }

            $name = $item['name'] ?? $item['label'] ?? $item['title'] ?? $item['subject'] ?? (string) $id;

            $templates[] = ['id' => (string) $id, 'name' => (string) $name];
        }

        return $templates;
    }
}
