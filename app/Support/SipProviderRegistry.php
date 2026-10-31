<?php

namespace App\Support;

/**
 * Single source of truth for the SIP providers CallBridge can integrate with.
 *
 * The integrations API (`/api/v1/call-bridge/integrations/providers`) and the
 * softphone device form both read from here, so the platform a line is created
 * with is what decides its WebSocket endpoint and SIP URI.
 */
class SipProviderRegistry
{
    /**
     * Per-platform connection defaults.
     *
     * `sipUriFormat` keeps the API contract (camelCase) because it is consumed
     * by the browser form and by external services.
     *
     * @var array<string, array{wss: string, sipUriFormat: string}>
     */
    public const PLATFORMS = [
        'sipgate' => [
            'wss' => 'wss://sip.sipgate.de',
            'sipUriFormat' => 'sip:{username}@sipgate.de',
        ],
    ];

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

    /** @return array{wss: string, sipUriFormat: string}|null */
    public static function defaults(?string $platform): ?array
    {
        return self::supports($platform) ? self::PLATFORMS[$platform] : null;
    }

    /** WebSocket endpoint the browser softphone registers against. */
    public static function wssUrl(?string $platform): ?string
    {
        return self::defaults($platform)['wss'] ?? null;
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
