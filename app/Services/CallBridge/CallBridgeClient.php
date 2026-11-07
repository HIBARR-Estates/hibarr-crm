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
     * Emit a call event to the call bridge so OL records the call happening.
     *
     * @param  array{event: string, call_id: string, direction: string, phone_number: string, entity_type: string, entity_id: int, status: string, duration?: int}  $payload
     * @return array<string, mixed>
     */
    public function emitCallEvent(array $payload): array
    {

        $formatted = $this->formatEmitPayload($payload);
        if ($formatted === null) {
            Log::warning('CallBridgeClient: emitCallEvent skipped — missing or invalid callId', [
                'payload' => $payload,
            ]);

            return [];
        }

        $pathKey = config('services.call_bridge.paths.emit') !== null ? 'emit' : 'emit_event';

        return $this->request('POST', $pathKey, $formatted);
    }

    /**
     * Map any incoming call event payload to OL's strict emitCallEventSchema:
     * - required: event, callId
     * - optional: direction, status, occurredAt, phoneNumber, durationSeconds, leg
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    private function formatEmitPayload(array $payload): ?array
    {
        // 1. Resolve callId (required, minLength: 1, maxLength: 191)
        $rawCallId = $payload['callId'] ?? $payload['call_id'] ?? null;
        if (! is_string($rawCallId) || trim($rawCallId) === '') {
            return null;
        }
        $callId = mb_substr(trim($rawCallId), 0, 191);

        // 2. Resolve direction
        $rawDirection = $payload['direction'] ?? null;
        $direction = in_array($rawDirection, ['inbound', 'outbound'], true) ? $rawDirection : null;

        // 3. Resolve event (required, enum)
        $rawEvent = (string) ($payload['event'] ?? '');
        $event = match ($rawEvent) {
            'incoming_call', 'outgoing_call', 'call_answered', 'call_completed', 'call_ended', 'call_missed', 'leg_update' => $rawEvent,
            'call.started', 'call_started' => ($direction === 'inbound') ? 'incoming_call' : 'outgoing_call',
            'call.answered', 'call_answered' => 'call_answered',
            'call.completed', 'call_completed' => 'call_completed',
            'call.ended', 'call_ended' => 'call_ended',
            'call.missed', 'call_missed' => 'call_missed',
            'call.declined', 'call_declined' => 'call_ended',
            'call.busy', 'call_busy' => 'call_ended',
            'call.failed', 'call_failed' => 'call_ended',
            'leg.update' => 'leg_update',
            default => ($direction === 'inbound') ? 'incoming_call' : 'outgoing_call',
        };

        if ($direction === null) {
            $direction = $event === 'incoming_call' ? 'inbound' : 'outbound';
        }

        // 4. Resolve status (enum)
        $allowedStatuses = [
            'queued', 'initiated', 'ringing', 'answered', 'completed',
            'busy', 'no_answer', 'rejected', 'failed', 'cancelled', 'unknown',
        ];
        $rawStatus = (string) ($payload['status'] ?? '');
        $status = match ($rawStatus) {
            'pending', 'started', 'calling' => 'initiated',
            'ended' => 'completed',
            default => in_array($rawStatus, $allowedStatuses, true) ? $rawStatus : null,
        };
        if ($status === null) {
            $status = match ($event) {
                'incoming_call', 'outgoing_call' => 'initiated',
                'call_answered' => 'answered',
                'call_completed', 'call_ended' => 'completed',
                'call_missed' => 'no_answer',
                default => 'unknown',
            };
        }

        $formatted = [
            'event' => $event,
            'callId' => $callId,
            'status' => $status,
            'direction' => $direction,
            'occurredAt' => isset($payload['occurredAt']) && is_string($payload['occurredAt']) && $payload['occurredAt'] !== ''
                ? $payload['occurredAt']
                : (isset($payload['occurred_at']) && $payload['occurred_at'] instanceof \DateTimeInterface
                    ? $payload['occurred_at']->format('c')
                    : now()->toIso8601String()),
        ];

        // 5. Phone number (nullable, max 32 chars)
        $rawPhone = $payload['phoneNumber'] ?? $payload['phone_number'] ?? $payload['phone'] ?? null;
        if (is_string($rawPhone) && trim($rawPhone) !== '') {
            $formatted['phoneNumber'] = mb_substr(trim($rawPhone), 0, 32);
        }

        // 6. Duration seconds (integer >= 0)
        $rawDuration = $payload['durationSeconds'] ?? $payload['duration_seconds'] ?? $payload['duration'] ?? null;
        if (is_numeric($rawDuration)) {
            $formatted['durationSeconds'] = max(0, (int) $rawDuration);
        }

        // 7. Leg (object, nullable)
        if (isset($payload['leg']) && is_array($payload['leg'])) {
            $legRole = $payload['leg']['role'] ?? null;
            $legStatus = $payload['leg']['status'] ?? null;
            $legExternalId = $payload['leg']['externalLegId'] ?? $payload['leg']['external_leg_id'] ?? null;

            $allowedRoles = ['agent', 'destination', 'provider', 'unknown'];
            $leg = [];
            if (is_string($legRole) && in_array($legRole, $allowedRoles, true)) {
                $leg['role'] = $legRole;
            }
            if (is_string($legStatus) && in_array($legStatus, $allowedStatuses, true)) {
                $leg['status'] = $legStatus;
            }
            if (is_string($legExternalId) && trim($legExternalId) !== '') {
                $leg['externalLegId'] = mb_substr(trim($legExternalId), 0, 191);
            }
            if (! empty($leg)) {
                $formatted['leg'] = $leg;
            }
        }

        return $formatted;
    }

    /**
     * The SIP platforms OL supports for call-bridge integrations
     * (GET /call-bridge/integrations/providers).
     *
     * @return array<int, string>
     */
    public function fetchSipProviders(): array
    {
        $data = $this->request('GET', 'providers');

        $providers = [];
        foreach ((array) ($data['providers'] ?? []) as $provider) {
            if (is_string($provider) && $provider !== '') {
                $providers[] = $provider;
            }
        }

        return array_values(array_unique($providers));
    }

    /**
     * The SIP connection defaults OL associates with one platform
     * (GET /call-bridge/integrations/providers/{platform}).
     *
     * Null when OL answers but the payload does not carry both fields — the
     * caller then decides whether to fall back to the local registry.
     *
     * @return array{wss: string, sipUriFormat: string}|null
     */
    public function fetchSipPlatformDefaults(string $platform): ?array
    {
        $data = $this->request('GET', 'platform', [], [], ['platform' => $platform]);

        $wss = $data['wss'] ?? null;
        $sipUriFormat = $data['sipUriFormat'] ?? null;

        if (! is_string($wss) || $wss === '' || ! is_string($sipUriFormat) || $sipUriFormat === '') {
            return null;
        }

        return ['wss' => $wss, 'sipUriFormat' => $sipUriFormat];
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
     * @param  array<string, string>  $pathParams  Values substituted into the
     *   configured path's `{placeholder}` segments (e.g. the platform name).
     * @return array<string, mixed>
     */
    private function request(string $method, string $pathKey, array $payload = [], array $query = [], array $pathParams = []): array
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

        foreach ($pathParams as $name => $value) {
            $path = str_replace('{'.$name.'}', rawurlencode($value), $path);
        }

        $url = rtrim($baseUrl, '/') . '/' . ltrim($path, '/');
        $method = strtoupper($method);

        try {
            $pending = Http::timeout($timeout)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                    'x-api-key' => $apiKey,
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
                // The upstream body can contain phone numbers, names and
                // credentials, so it is redacted before it reaches the log.
                'body' => $this->redactForLog($response->body()),
            ]);

            throw new HttpException(
                $response->status() >= 400 && $response->status() < 600 ? $response->status() : 502,
                $response->json('message') ?? 'Call bridge request failed.'
            );
        }

        return $this->decode($response);
    }

    /**
     * Make an upstream payload safe to write to the log.
     *
     * The call bridge echoes back the payload it was given, which carries
     * phone numbers, contact names and occasionally a token. Only a short,
     * redacted excerpt is kept so a failure can still be diagnosed.
     */
    private function redactForLog(string $body): string
    {
        $redacted = preg_replace('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', '[email]', $body) ?? $body;

        // Credentials are redacted before the phone numbers: a token can look
        // like a phone number, and the phone pattern below would otherwise
        // mangle it into "[phone]" instead of a redaction marker.
        $redacted = $this->redactCredentials($redacted);

        // Phone numbers in every notation the bridge uses (+49 170 1234567,
        // 0049-170-1234567, 491701234567).
        $redacted = preg_replace('/(?<!\d)\+?\d[\d\s().\/-]{6,}\d(?!\d)/', '[phone]', $redacted) ?? $redacted;

        $redacted = trim($redacted);

        if (mb_strlen($redacted) > 500) {
            $redacted = mb_substr($redacted, 0, 500).'…';
        }

        return $redacted;
    }

    /**
     * Replace credential values with a redaction marker.
     *
     * The bridge echoes the payload it was given, so the body carries keys
     * like "access_token" or "refresh_token". The key may be quoted (JSON),
     * bare (form encoding) or prefixed ("api_key"), and the value is either a
     * JSON string or a bare token. The whole value is replaced — the key keeps
     * its own quoting so the log stays readable.
     */
    private function redactCredentials(string $body): string
    {
        $names = 'api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|secret|password|passwd|authorization|client[_-]?secret|private[_-]?key';

        $redacted = preg_replace_callback(
            '/(?:"(?P<quoted>[^"]*)"|(?P<bare>[A-Za-z0-9_.\-]+))(?P<sep>\s*[:=]\s*)(?P<value>"(?:[^"\\\\]|\\\\.)*"|\'[^\']*\'|(?:Bearer|Basic|Digest|Token)\s+[^\s,;}\]]+|[^\s,;}\]]+)/i',
            function (array $matches) use ($names): string {
                $name = $matches['quoted'] !== '' ? $matches['quoted'] : ($matches['bare'] ?? '');

                if (! preg_match('/(?:^|[._\-])'.$names.'(?:$|[._\-])/i', $name)) {
                    return $matches[0];
                }

                $key = $matches['quoted'] !== '' ? '"'.$name.'"' : $name;
                $value = $matches['value'];
                $marker = ($value !== '' && ($value[0] === '"' || $value[0] === "'"))
                    ? '"[redacted]"'
                    : '[redacted]';

                return $key.$matches['sep'].$marker;
            },
            $body
        );

        return $redacted ?? $body;
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
