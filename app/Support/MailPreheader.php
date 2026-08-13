<?php

namespace App\Support;

/**
 * Brevo-style inbox preview text ("preheader").
 *
 * Clients that respect it read the first hidden block; the padding stops them
 * from appending body copy into the inbox snippet. Clients that ignore
 * display:none (some mobile push UIs) still fall back to the first visible
 * body text — keep that line short too.
 */
final class MailPreheader
{
    /** Soft cap for inbox preview (Brevo: ~40–130; mobile often ~40–70). */
    public const MAX_CHARS = 90;

    /** Padding length — must fill typical preview budgets so body does not leak. */
    public const PAD_UNITS = 120;

    public static function sanitize(mixed $value, int $maxChars = self::MAX_CHARS): string
    {
        if (! is_string($value)) {
            return '';
        }

        $text = $value;
        if (strlen($text) > 500) {
            $text = substr($text, 0, 500);
        }

        $text = html_entity_decode(
            strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</div>'], ' ', $text)),
            ENT_QUOTES,
            'UTF-8'
        );
        $text = preg_replace('/^#+\s*/m', '', $text) ?? $text;
        $text = trim(preg_replace('/\s+/', ' ', $text) ?? $text);

        if ($text !== '' && strlen($text) > $maxChars) {
            $text = substr($text, 0, $maxChars);
        }

        return $text;
    }

    /**
     * Hidden HTML block to place as the first child of the email body wrapper.
     * Escapes the preview text; padding is raw entities.
     */
    public static function hiddenHtml(string $preheader, int $maxChars = self::MAX_CHARS): string
    {
        $text = self::sanitize($preheader, $maxChars);
        if ($text === '') {
            return '';
        }

        $pad = str_repeat('&nbsp;&zwnj;', self::PAD_UNITS);

        return '<div style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;color:#eef2f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">'
            . htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
            . $pad
            . '</div>';
    }

    /** Raw padding string for static Plunk HTML templates. */
    public static function padHtml(): string
    {
        return str_repeat('&nbsp;&zwnj;', self::PAD_UNITS);
    }
}
