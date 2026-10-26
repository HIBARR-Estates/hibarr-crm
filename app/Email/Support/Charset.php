<?php

namespace App\Email\Support;

use Throwable;

/**
 * Brings message bodies to UTF-8, the only encoding the CRM stores. A body
 * that declares another charset is decoded from it; if that cannot be done
 * the original is kept rather than lost, with only the bytes that are not
 * valid UTF-8 replaced so it can still be stored and shown.
 */
class Charset
{
    public static function toUtf8(?string $body, ?string $declared = null): ?string
    {
        if ($body === null || $body === '') {
            return $body;
        }

        $declared = self::normalize($declared);

        if ($declared !== null && $declared !== 'UTF-8') {
            $decoded = self::decode($body, $declared);

            if ($decoded !== null) {
                return $decoded;
            }
        }

        return mb_check_encoding($body, 'UTF-8') ? $body : mb_scrub($body, 'UTF-8');
    }

    /** The charset an HTML document declares for itself in a meta tag, if any. */
    public static function declaredIn(?string $html): ?string
    {
        if ($html === null) {
            return null;
        }

        // Declarations sit at the top; no need to scan a whole newsletter.
        $head = substr($html, 0, 4096);

        if (preg_match('/<meta[^>]+charset\s*=\s*["\']?\s*([a-z0-9._:\-]+)/i', $head, $match) === 1) {
            return $match[1];
        }

        return null;
    }

    private static function decode(string $body, string $charset): ?string
    {
        try {
            $decoded = @iconv($charset, 'UTF-8', $body);
        } catch (Throwable) {
            $decoded = false;
        }

        if (! is_string($decoded) || $decoded === '') {
            try {
                $decoded = in_array(strtoupper($charset), array_map('strtoupper', mb_list_encodings()), true)
                    ? mb_convert_encoding($body, 'UTF-8', $charset)
                    : false;
            } catch (Throwable) {
                $decoded = false;
            }
        }

        return is_string($decoded) && $decoded !== '' && mb_check_encoding($decoded, 'UTF-8') ? $decoded : null;
    }

    private static function normalize(?string $charset): ?string
    {
        $charset = strtoupper(trim((string) $charset, " \t\"'"));

        return match ($charset) {
            '' => null,
            'UTF8' => 'UTF-8',
            default => $charset,
        };
    }
}
