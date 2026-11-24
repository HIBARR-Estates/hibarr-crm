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
     * @var array<string, array{wss: string, sipUriFormat: string, defaultMaxConcurrentCalls: int, stun?: string, digestRealm?: string}>
     */
    public const PLATFORMS = [
        'sipgate' => [
            'wss' => 'wss://sip.sipgate.de',
            'sipUriFormat' => 'sip:{username}@sipgate.de',
            'defaultMaxConcurrentCalls' => 2,
            'stun' => 'stun:stun.sipgate.de:3478',
            // SIP digest realm the provider challenges with; needed to precompute the HA1 hash.
            'digestRealm' => 'sipgate.de',
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

    /** @return array{wss: string, sipUriFormat: string, defaultMaxConcurrentCalls?: int, stun?: string, digestRealm?: string}|null */
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

    /** SIP digest realm for a platform, or null when it is not known. */
    public static function digestRealm(?string $platform): ?string
    {
        return self::defaults($platform)['digestRealm'] ?? null;
    }

    /**
     * Digest HA1 = md5("username:realm:password") (RFC 2617). Lets the browser
     * answer the SIP digest challenge without ever holding the password: the
     * hash authenticates but cannot be reversed. Null when it cannot be built.
     */
    public static function ha1(?string $platform, ?string $username, ?string $password): ?string
    {
        $realm = self::digestRealm($platform);
        $username = (string) $username;
        $password = (string) $password;

        if ($realm === null || $username === '' || $password === '') {
            return null;
        }

        return md5($username.':'.$realm.':'.$password);
    }

    /**
     * Compute an RFC 2617 SIP Digest challenge response for a single request.
     *
     * Runs strictly on the server so neither the plaintext SIP password nor
     * the reusable HA1 hash ever leaves the backend.
     */
    public static function signDigestChallenge(
        string $username,
        string $password,
        string $realm,
        string $method,
        string $uri,
        string $nonce,
        ?string $qop = null,
        ?string $nc = null,
        ?string $cnonce = null,
        ?string $bodyMd5 = null,
    ): string {
        $ha1 = md5($username.':'.$realm.':'.$password);

        if ($qop === 'auth') {
            $ha2 = md5($method.':'.$uri);

            return md5($ha1.':'.$nonce.':'.$nc.':'.$cnonce.':auth:'.$ha2);
        }

        if ($qop === 'auth-int') {
            $ha2 = md5($method.':'.$uri.':'.($bodyMd5 ?? md5('')));

            return md5($ha1.':'.$nonce.':'.$nc.':'.$cnonce.':auth-int:'.$ha2);
        }

        $ha2 = md5($method.':'.$uri);

        return md5($ha1.':'.$nonce.':'.$ha2);
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
