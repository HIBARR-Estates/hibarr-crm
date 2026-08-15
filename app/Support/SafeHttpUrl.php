<?php

namespace App\Support;

/**
 * Validates external URLs for notification actions (http/https only).
 */
final class SafeHttpUrl
{
    public static function validate(?string $url): ?string
    {
        $link = trim((string) ($url ?? ''));
        if ($link === '' || ! filter_var($link, FILTER_VALIDATE_URL)) {
            return null;
        }

        $scheme = strtolower((string) (parse_url($link, PHP_URL_SCHEME) ?? ''));

        return in_array($scheme, ['http', 'https'], true) ? $link : null;
    }
}
