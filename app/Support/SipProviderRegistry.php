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
     * Everything the browser softphone does differently per provider lives
     * here too, so adding a provider is one entry (see DEFAULT_CLIENT_PROFILE
     * for what an entry may leave out):
     *   - `label`             name shown to agents in messages
     *   - `digestRealm`       realm the provider's 401/407 challenges carry;
     *                         the signing endpoint refuses any other realm
     *   - `digestAlgorithms`  Digest algorithms the server will sign for
     *   - `identityHeader`    header carrying the line's URI on outgoing
     *                         INVITEs, or null to send none
     *   - `messages`          agent-facing errors; any key left out falls back
     *                         to the generic wording (`:provider` and `:status`
     *                         are filled in)
     *
     * @var array<string, array{wss: string, sipUriFormat: string, defaultMaxConcurrentCalls: int, stun?: string, digestRealm?: string, label?: string, digestAlgorithms?: list<string>, identityHeader?: string|null, messages?: array<string, mixed>}>
     */
    public const PLATFORMS = [
        'sipgate' => [
            'wss' => 'wss://sip.sipgate.de',
            'sipUriFormat' => 'sip:{username}@sipgate.de',
            'defaultMaxConcurrentCalls' => 2,
            'stun' => 'stun:stun.sipgate.de:3478',
            'digestRealm' => 'sipgate.de',
            'label' => 'sipgate',
            'digestAlgorithms' => ['MD5'],
            // sipgate accepts the line's own SIP URI as the caller identity.
            'identityHeader' => 'P-Preferred-Identity',
            'messages' => [
                'not_registered' => "Your phone line isn't connected to sipgate. Pick a line in the phone panel, then retry.",
                'registration_auth_failed' => 'sipgate rejected this line\'s SIP ID or password. Check them in your sipgate account.',
                'registration_rejected' => 'sipgate rejected the registration (:status).',
                'registration_timeout' => 'sipgate did not answer the registration in time.',
                'transport_failed' => 'Could not reach sipgate (wss://sip.sipgate.de). Check the internet connection or firewall.',
                'invite_failed' => 'The call could not be placed — the request to sipgate failed.',
                'call_status' => [
                    '403' => 'sipgate refused the call. Check in your sipgate account that this line may call out (credit, call barring, caller ID).',
                    '488' => 'sipgate could not accept the call\'s audio settings.',
                    '500' => 'sipgate had an internal error. Try again in a moment.',
                    '503' => 'sipgate is temporarily unavailable. Try again in a moment.',
                ],
            ],
        ],
    ];

    /** Public STUN server every line gets, before the provider's own. */
    public const DEFAULT_STUN = 'stun:stun.l.google.com:19302';

    /**
     * What a provider gets for anything its PLATFORMS entry leaves out, and
     * what a line with no known provider uses. The wording is deliberately
     * provider-neutral.
     *
     * @var array{label: string, digestAlgorithms: list<string>, identityHeader: string|null, messages: array<string, mixed>}
     */
    public const DEFAULT_CLIENT_PROFILE = [
        'label' => 'your SIP provider',
        'digestAlgorithms' => ['MD5'],
        'identityHeader' => 'P-Preferred-Identity',
        'messages' => [
            'not_registered' => "Your phone line isn't connected to :provider. Pick a line in the phone panel, then retry.",
            'registration_auth_failed' => 'The line rejected the username or password.',
            'registration_rejected' => 'The line rejected the registration (:status).',
            'registration_timeout' => 'The line did not answer the registration in time.',
            'transport_failed' => 'Could not connect to the WSS URL. Check the address and that the server is reachable.',
            'invite_failed' => 'The call could not be placed — the request to :provider failed.',
            'call_status' => [],
        ],
    ];

    /** Digest algorithms signDigestChallenge() can compute. */
    public const SUPPORTED_DIGEST_ALGORITHMS = ['MD5', 'SHA-256'];

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

    /** Digest algorithms the server signs for on this platform (upper-case). */
    public static function digestAlgorithms(?string $platform): array
    {
        $algorithms = self::defaults($platform)['digestAlgorithms'] ?? self::DEFAULT_CLIENT_PROFILE['digestAlgorithms'];

        return array_values(array_intersect(
            array_map('strtoupper', $algorithms),
            self::SUPPORTED_DIGEST_ALGORITHMS,
        ));
    }

    /** SIP domain of the platform's URI format (`sipgate.de`), or null. */
    public static function sipDomain(?string $platform): ?string
    {
        $format = self::defaults($platform)['sipUriFormat'] ?? null;
        if ($format === null || ! str_contains($format, '@')) {
            return null;
        }

        $domain = trim(explode(';', substr($format, strpos($format, '@') + 1))[0]);

        return $domain !== '' ? $domain : null;
    }

    /**
     * Everything the browser softphone needs to behave correctly for this
     * provider, with the provider's own wording merged over the generic one.
     * Contains no secrets; sent with a line's connection settings.
     *
     * @return array{key: string|null, label: string, sip_domain: string|null, ice_servers: list<array{urls: string}>, digest_algorithms: list<string>, identity_header: string|null, messages: array<string, mixed>}
     */
    public static function clientProfile(?string $platform): array
    {
        $entry = self::defaults($platform) ?? [];
        $base = self::DEFAULT_CLIENT_PROFILE;
        $label = $entry['label'] ?? $base['label'];

        $messages = array_replace($base['messages'], $entry['messages'] ?? []);
        $messages['call_status'] = array_replace($base['messages']['call_status'], $entry['messages']['call_status'] ?? []);
        $fill = fn (string $text): string => str_replace(':provider', $label, $text);
        foreach ($messages as $key => $text) {
            $messages[$key] = is_array($text) ? array_map($fill, $text) : $fill($text);
        }

        $ice = [['urls' => self::DEFAULT_STUN]];
        if (isset($entry['stun'])) {
            $ice[] = ['urls' => $entry['stun']];
        }

        return [
            'key' => self::supports($platform) ? $platform : null,
            'label' => $label,
            'sip_domain' => self::sipDomain($platform),
            'ice_servers' => $ice,
            'digest_algorithms' => self::digestAlgorithms($platform),
            'identity_header' => array_key_exists('identityHeader', $entry) ? $entry['identityHeader'] : $base['identityHeader'],
            'messages' => $messages,
        ];
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
     * Compute a SIP Digest challenge response for a single request: RFC 2617
     * for MD5, RFC 7616/8760 for SHA-256 (same construction, other hash).
     *
     * Runs strictly on the server so neither the plaintext SIP password nor
     * the reusable HA1 hash ever leaves the backend. `auth-int` is only
     * signed for an empty body (the browser passes bodies through unsigned),
     * so the body hash is always H("").
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
        string $algorithm = 'MD5',
    ): string {
        $hash = match (strtoupper($algorithm)) {
            'MD5' => fn (string $v): string => md5($v),
            'SHA-256' => fn (string $v): string => hash('sha256', $v),
            default => throw new \InvalidArgumentException("Unsupported digest algorithm: {$algorithm}"),
        };

        $ha1 = $hash($username.':'.$realm.':'.$password);

        if ($qop === 'auth') {
            return $hash($ha1.':'.$nonce.':'.$nc.':'.$cnonce.':auth:'.$hash($method.':'.$uri));
        }

        if ($qop === 'auth-int') {
            return $hash($ha1.':'.$nonce.':'.$nc.':'.$cnonce.':auth-int:'.$hash($method.':'.$uri.':'.$hash('')));
        }

        return $hash($ha1.':'.$nonce.':'.$hash($method.':'.$uri));
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
