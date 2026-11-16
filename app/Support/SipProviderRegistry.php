<?php

namespace App\Support;

/**
 * Single source of truth for the SIP providers CallBridge can integrate with.
 *
 * The integrations API (`/api/v1/call-bridge/integrations/providers`) serves
 * OL's list when the call bridge is configured and falls back to this
 * registry when it is not; the softphone device form reads that API, so the
 * platform a line is created with is what decides its WebSocket endpoint and
 * SIP URI.
 */
class SipProviderRegistry
{
    /**
     * Per-platform connection defaults.
     *
     * `sipUriFormat` keeps the API contract (camelCase) because it is consumed
     * by the browser form and by external services.
     *
     * @var array<string, array{wss: string, sipUriFormat: string, defaultMaxConcurrentCalls: int, stun?: string}>
     */
    public const PLATFORMS = [
        'sipgate' => [
            'wss' => 'wss://sip.sipgate.de',
            'sipUriFormat' => 'sip:{username}@sipgate.de',
            'defaultMaxConcurrentCalls' => 2,
            'stun' => 'stun:stun.sipgate.de:3478',
        ],
    ];

    public const DEFAULT_MAX_CONCURRENT_CALLS = 2;

    /** @return list<string> */
    public static function names(): array
    {
        return array_keys(self::PLATFORMS);
    }

    public static function supports(?string $platform): bool
    {
        return $platform !== null
            && $platform !== ''
            && array_key_exists($platform, self::PLATFORMS);
    }

    /** @return array{wss: string, sipUriFormat: string, defaultMaxConcurrentCalls?: int, stun?: string}|null */
    public static function defaults(?string $platform): ?array
    {
        return self::supports($platform) ? self::PLATFORMS[$platform] : null;
    }

    /** WebSocket endpoint the browser softphone registers against. */
    public static function wssUrl(?string $platform): ?string
    {
        return self::defaults($platform)['wss'] ?? null;
    }

    /** Default max concurrent calls for a platform line (default 2). */
    public static function defaultMaxConcurrentCalls(?string $platform): int
    {
        return self::defaults($platform)['defaultMaxConcurrentCalls'] ?? self::DEFAULT_MAX_CONCURRENT_CALLS;
    }

    /** STUN server for WebRTC ICE negotiation. */
    public static function stunUrl(?string $platform): ?string
    {
        return self::defaults($platform)['stun'] ?? null;
    }

    /**
     * Concrete SIP identity for a platform line, e.g.
     * `sip:4711@sipgate.de`. Returns null when the username is missing — the
     * URI format cannot be resolved without it.
     */
    public static function sipUri(?string $platform, ?string $username): ?string
    {
        $defaults = self::defaults($platform);
        $username = trim((string) $username);

        if ($defaults === null || $username === '') {
            return null;
        }

        return str_replace('{username}', $username, $defaults['sipUriFormat']);
    }
}
