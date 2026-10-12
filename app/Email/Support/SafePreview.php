<?php

namespace App\Email\Support;

use Illuminate\Support\Str;

/**
 * A short plain-text excerpt of a message for lists. Never markup: when only
 * HTML is available its tags are stripped, so nothing here can be rendered
 * as HTML by mistake.
 */
class SafePreview
{
    public const LENGTH = 200;

    public static function from(?string $text, ?string $htmlRaw = null, int $length = self::LENGTH): ?string
    {
        $plain = trim((string) $text) !== '' ? (string) $text : self::textOf((string) $htmlRaw);

        // Tags are stripped from the text part too: a "plain" body can still carry markup.
        $plain = trim((string) preg_replace('/\s+/u', ' ', strip_tags($plain)));

        return $plain === '' ? null : Str::limit($plain, $length, '…');
    }

    private static function textOf(string $html): string
    {
        if ($html === '') {
            return '';
        }

        // Drop what is never content before removing the tags themselves.
        $html = (string) preg_replace('#<(script|style|head|title)\b[^>]*>.*?</\1\s*>#is', ' ', $html);
        $html = (string) preg_replace('#<(br|/p|/div|/li|/tr|/h[1-6])\b[^>]*>#i', ' ', $html);

        return html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
}
