<?php

namespace App\Services\CallBridge;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Low-level HTTP client for OL's call bridge.
 *
 * OL owns all call data — this client never persists anything, it only
 * starts/ends calls and pulls status/event feeds that CallBridgeService
 * turns into timeline events. Paths and credentials come from
 * config('services.call_bridge.*').
 */
class CallBridgeClient
{
    /**
     * Start a call through the OL call bridge.
     *
     * @param  array{phone_number: string, entity_type: string, entity_id: int, user_id: int}  $payload
     * @return array<string, mixed>
     */
    public function startCall(array $payload): array
    {
        return $this->request('POST', 'start_call', $payload);
    }

    /**
     * End an active call through the OL call bridge.
     *
     * @return array<string, mixed>
     */
    public function endCall(string $callId): array
    {
        return $this->request('POST', 'end_call', ['call_id' => $callId]);
    }

    /**
     * Fetch the current status of a single call.
     *
     * @return array<string, mixed>
     */
    public function getCallStatus(string $callId): array
    {
        return $this->request('GET', 'status', [], ['call_id' => $callId]);
    }

    /**
     * Fetch calls that are currently active on the bridge.
     *
     * @return array<string, mixed>
     */
    public function getActiveCalls(): array
    {
        return $this->request('GET', 'active_calls');
    }

    /**
     * Fetch call events emitted by the bridge since a cursor.
     *
     * @param  string|null  $since  ISO-8601 timestamp of the last processed event.
     * @param  int  $limit
     * @return array{events: array<int, array<string, mixed>>, cursor: string|null, has_more: bool}
     */
    public function fetchEvents(?string $since = null, int $limit = 100): array
    {
        $query = ['limit' => $limit];
        if ($since !== null && $since !== '') {
            $query['since'] = $since;
        }

        $data = $this->request('GET', 'events', [], $query);

        $events = [];
        foreach ((array) ($data['events'] ?? $data['data'] ?? []) as $event) {
            if (is_array($event)) {
                $events[] = $event;
            }
        }

        return [
            'events' => $events,
            'cursor' => is_string($data['cursor'] ?? null) ? $data['cursor'] : null,
            'has_more' => (bool) ($data['has_more'] ?? false),
        ];
    }

    /**
     * Whether the bridge is configured enough to be called at all.
     */
    public function configured(): bool
    {
        return $this->baseUrl() !== '' && $this->apiKey() !== '';
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, scalar>  $query
     * @return array<string, mixed>
     */
    private function request(string $method, string $pathKey, array $payload = [], array $query = []): array
    {
        $baseUrl = $this->baseUrl();
        $apiKey = $this->apiKey();
        $timeout = (int) config('services.call_bridge.timeout', 15);

        if ($baseUrl === '' || $apiKey === '') {
            Log::error('CallBridgeClient: call bridge config missing', [
                'base_url_set' => $baseUrl !== '',
                'api_key_set' => $apiKey !== '',
            ]);

            throw new HttpException(503, 'Call bridge service is not configured.');
        }

        $path = (string) config("services.call_bridge.paths.{$pathKey}", '');
        if ($path === '') {
            throw new HttpException(503, "Call bridge path [{$pathKey}] is not configured.");
        }

        $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/');
        $method = strtoupper($method);

        try {
            $pending = Http::timeout($timeout)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'X-Api-Key' => $apiKey,
                    'Accept' => 'application/json',
                ]);

            $response = match ($method) {
                'GET' => $pending->get($url, $query),
                'POST' => $pending->post($url, $payload),
                default => throw new \InvalidArgumentException("Unsupported HTTP method: {$method}"),
            };
        } catch (\Throwable $e) {
            Log::error('CallBridgeClient: OL request failed', [
                'method' => $method,
                'path_key' => $pathKey,
                'url' => $url,
                'error' => $e->getMessage(),
            ]);

            throw new HttpException(502, 'Unable to reach call bridge service.');
        }

        if (!$response->successful()) {
            Log::error('CallBridgeClient: OL returned non-2xx', [
                'method' => $method,
                'path_key' => $pathKey,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            throw new HttpException(
                $response->status() >= 400 && $response->status() < 600 ? $response->status() : 502,
                $response->json('message') ?? 'Call bridge request failed.'
            );
        }

        return $this->decode($response);
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(Response $response): array
    {
        $json = $response->json();

        if (!is_array($json)) {
            return [];
        }

        $data = is_array($json['data'] ?? null) ? $json['data'] : [];

        return array_merge($data, [
            'message' => is_string($json['message'] ?? null) ? $json['message'] : null,
        ]);
    }

    private function baseUrl(): string
    {
        return (string) config('services.call_bridge.base_url', '');
    }

    private function apiKey(): string
    {
        return (string) config('services.call_bridge.api_key', '');
    }
}
