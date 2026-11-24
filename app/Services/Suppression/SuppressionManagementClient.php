<?php

namespace App\Services\Suppression;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Client for OL's Release 2 suppression restrictions, block, and lift APIs
 * (SUP-D11 / SUP-D13).
 *
 * The CRM never caches or persists a copy of the suppression list; it queries
 * OL directly and forwards the acting CRM user on every write.
 */
class SuppressionManagementClient
{
    /**
     * @return array{unavailable: bool, restrictions: array<int, array<string, mixed>>}
     */
    public function getEntityRestrictions(string $entityType, int $entityId, User $actor): array
    {
        return $this->fetchRestrictions(
            '/suppression-restrictions/'.urlencode($entityType).'/'.$entityId,
            [],
            $actor,
            ['entity_type' => $entityType, 'entity_id' => $entityId]
        );
    }

    /**
     * @return array{unavailable: bool, restrictions: array<int, array<string, mixed>>}
     */
    public function getHandleRestrictions(string $handle, ?string $channel, User $actor): array
    {
        $query = ['handle' => trim($handle)];

        if ($channel !== null && trim($channel) !== '') {
            $query['channel'] = trim($channel);
        }

        return $this->fetchRestrictions(
            '/suppression-restrictions',
            $query,
            $actor,
            ['handle' => $this->maskHandle($handle, $channel)]
        );
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{ok: bool, status: int, data: ?array<string, mixed>, message: string}
     */
    public function block(array $payload, User $actor): array
    {
        return $this->postWrite('/suppressions', $payload, $actor);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{ok: bool, status: int, data: ?array<string, mixed>, message: string}
     */
    public function lift(string $uuid, array $payload, User $actor): array
    {
        return $this->postWrite('/suppressions/'.urlencode($uuid).'/lift', $payload, $actor);
    }

    /**
     * @param  array<string, mixed>  $query
     * @param  array<string, mixed>  $logContext
     * @return array{unavailable: bool, restrictions: array<int, array<string, mixed>>}
     */
    private function fetchRestrictions(string $path, array $query, User $actor, array $logContext): array
    {
        $baseUrl = $this->baseUrl();
        $apiKey = $this->apiKey();

        if ($baseUrl === '' || $apiKey === '') {
            Log::warning('SuppressionManagementClient: OL endpoint not configured.', $logContext);

            return ['unavailable' => true, 'restrictions' => []];
        }

        $url = rtrim($baseUrl, '/').$path;

        try {
            $response = Http::timeout($this->timeout())
                ->withHeaders($this->actorHeaders($actor, $apiKey))
                ->get($url, $query);
        } catch (\Throwable $exception) {
            Log::warning('SuppressionManagementClient: lookup request failed.', array_merge($logContext, [
                'error' => $exception->getMessage(),
            ]));

            return ['unavailable' => true, 'restrictions' => []];
        }

        if (! $response->successful()) {
            Log::warning('SuppressionManagementClient: lookup returned non-2xx.', array_merge($logContext, [
                'status' => $response->status(),
            ]));

            return ['unavailable' => true, 'restrictions' => []];
        }

        $data = $response->json('data');
        if (! is_array($data)) {
            return ['unavailable' => true, 'restrictions' => []];
        }

        $restrictions = $data['restrictions'] ?? [];

        return [
            'unavailable' => false,
            'restrictions' => is_array($restrictions) ? array_values(array_filter($restrictions, 'is_array')) : [],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{ok: bool, status: int, data: ?array<string, mixed>, message: string}
     */
    private function postWrite(string $path, array $payload, User $actor): array
    {
        $baseUrl = $this->baseUrl();
        $apiKey = $this->apiKey();

        if ($baseUrl === '' || $apiKey === '') {
            return [
                'ok' => false,
                'status' => 503,
                'data' => null,
                'message' => 'Suppression service is currently unavailable.',
            ];
        }

        $url = rtrim($baseUrl, '/').$path;

        try {
            $response = Http::timeout($this->timeout())
                ->withHeaders($this->actorHeaders($actor, $apiKey))
                ->post($url, $payload);
        } catch (\Throwable $exception) {
            Log::warning('SuppressionManagementClient: write request failed.', [
                'path' => $path,
                'error' => $exception->getMessage(),
            ]);

            return [
                'ok' => false,
                'status' => 503,
                'data' => null,
                'message' => 'Suppression service could not be reached. Please try again.',
            ];
        }

        $body = $response->json();
        $message = is_array($body) && is_string($body['message'] ?? null)
            ? $body['message']
            : ($response->successful() ? 'OK' : 'Suppression request failed.');

        if (! $response->successful()) {
            return [
                'ok' => false,
                'status' => $response->status(),
                'data' => is_array($body['data'] ?? null) ? $body['data'] : null,
                'message' => $message,
            ];
        }

        return [
            'ok' => true,
            'status' => $response->status(),
            'data' => is_array($body['data'] ?? null) ? $body['data'] : null,
            'message' => $message,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function actorHeaders(User $actor, string $apiKey): array
    {
        return [
            'Accept' => 'application/json',
            'X-Api-Key' => $apiKey,
            'x-crm-user-id' => (string) $actor->id,
            'x-crm-user-name' => (string) ($actor->name ?: $actor->email ?: 'crm-user'),
        ];
    }

    private function maskHandle(string $handle, ?string $channel): string
    {
        if (str_contains($handle, '@') || $channel === 'email') {
            return SuppressionClient::maskEmail($handle);
        }

        return SuppressionClient::maskPhone($handle);
    }

    private function baseUrl(): string
    {
        return trim((string) config('services.ol.base_url', ''));
    }

    private function apiKey(): string
    {
        return trim((string) config('services.ol.api_key', ''));
    }

    private function timeout(): int
    {
        return max(1, (int) config('services.ol.timeout', 15));
    }
}
