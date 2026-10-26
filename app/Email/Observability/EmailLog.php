<?php

namespace App\Email\Observability;

use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Structured CRM Email logs and job metrics. Context is scrubbed so bodies,
 * drafts, credentials and tokens never reach the log stack. The 2-minute
 * visibility lag is measured when known — it is not an SLO.
 */
final class EmailLog
{
    /** @var list<string> */
    private const FORBIDDEN_KEYS = [
        'body',
        'text',
        'text_body',
        'html',
        'html_body',
        'html_raw',
        'textbody',
        'htmlbody',
        'preview',
        'snippet',
        'draft',
        'draft_payload',
        'credentials',
        'credential',
        'token',
        'api_token',
        'access_token',
        'refresh_token',
        'password',
        'smtp_password',
        'smtp_username',
        'secret',
        'authorization',
        'content',
        'bytes',
        'payload',
        'raw',
        'message_body',
    ];

    /**
     * @param  array<string, mixed>  $context
     */
    public static function info(string $event, array $context = []): void
    {
        self::write('info', $event, $context);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public static function warning(string $event, array $context = []): void
    {
        self::write('warning', $event, $context);
    }

    /**
     * Job / duration metrics — same scrubbing rules as events.
     *
     * @param  array<string, mixed>  $context
     */
    public static function metric(string $name, array $context = []): void
    {
        self::write('info', $name, ['metric' => true] + $context);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public static function permissionDenied(string $action, array $context = []): void
    {
        self::write('warning', 'email.permission_denied', ['action' => $action] + $context);
    }

    /**
     * Drop forbidden keys (case-insensitive) and nested arrays that look like secrets.
     *
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public static function scrub(array $context): array
    {
        $clean = [];

        foreach ($context as $key => $value) {
            $name = strtolower((string) $key);

            if (self::isForbidden($name)) {
                continue;
            }

            if (is_array($value)) {
                // Nested credential bags / draft arrays are never logged.
                if (self::isForbidden($name) || self::looksLikeSecretBag($value)) {
                    continue;
                }
                $value = self::scrub($value);
            }

            if (is_string($value) && self::looksLikeSecretString($name, $value)) {
                continue;
            }

            $clean[$key] = $value;
        }

        return $clean;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private static function write(string $level, string $event, array $context): void
    {
        try {
            $payload = self::scrub(['event' => $event] + $context);
            Log::log($level, $event, $payload);
        } catch (Throwable) {
            // Observability must never break mail flows.
        }
    }

    private static function isForbidden(string $key): bool
    {
        if (in_array($key, self::FORBIDDEN_KEYS, true)) {
            return true;
        }

        foreach (['password', 'token', 'secret', 'credential', 'authorization'] as $needle) {
            if (str_contains($key, $needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<mixed>  $value
     */
    private static function looksLikeSecretBag(array $value): bool
    {
        foreach (array_keys($value) as $key) {
            if (self::isForbidden(strtolower((string) $key))) {
                return true;
            }
        }

        return false;
    }

    private static function looksLikeSecretString(string $key, string $value): bool
    {
        if ($value === '') {
            return false;
        }

        // Long opaque strings on sensitive-looking keys (e.g. bearer leftovers).
        if (str_contains($key, 'auth') && strlen($value) > 40) {
            return true;
        }

        return str_starts_with(strtolower($value), 'bearer ');
    }
}
