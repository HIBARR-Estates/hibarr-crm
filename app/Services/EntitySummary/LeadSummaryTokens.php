<?php

namespace App\Services\EntitySummary;

/**
 * Replacement tokens the lead summary model writes in place of the lead's name.
 *
 * The model never sees who the lead is (see LeadSummaryRedactor), so it cannot write
 * their name. Instead it writes a token such as `{{lead_first_name}}`, and the card
 * swaps in the real name when it renders. The stored summary therefore holds tokens,
 * never the name.
 *
 * Three places must agree on this list: the prompt (lead-summary-agent-prompt.md),
 * this class, and the card (resources/js/Components/EntitySummary/summaryTokens.ts).
 * LeadSummaryTokensTest fails if they drift.
 */
final class LeadSummaryTokens
{
    /** @var list<string> */
    public const NAMES = [
        'lead_first_name',
        'lead_full_name',
    ];

    private const TOKEN_PATTERN = '/\{\{\s*([A-Za-z0-9_.\-]*)\s*\}\}/';

    /**
     * Normalise tokens in every string of a summary: known ones are written in their
     * canonical `{{name}}` form (the model may add spaces or change case), and anything
     * else is removed, so a made-up token such as `{{lead_nickname}}` never reaches
     * the card or the database.
     *
     * @param  array<string, mixed>  $summary
     * @return array<string, mixed>
     */
    public static function sanitize(array $summary): array
    {
        return self::walk($summary);
    }

    /**
     * @param  array<int|string, mixed>  $value
     * @return array<int|string, mixed>
     */
    private static function walk(array $value): array
    {
        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $value[$key] = self::walk($item);
            } elseif (is_string($item) && str_contains($item, '{{')) {
                $value[$key] = self::sanitizeString($item);
            }
        }

        return $value;
    }

    private static function sanitizeString(string $text): string
    {
        $removed = false;

        $text = preg_replace_callback(
            self::TOKEN_PATTERN,
            function (array $match) use (&$removed): string {
                $name = strtolower($match[1]);

                if (in_array($name, self::NAMES, true)) {
                    return '{{'.$name.'}}';
                }

                $removed = true;

                return '';
            },
            $text
        ) ?? $text;

        // Removing a token can leave a doubled space or a space before punctuation.
        if ($removed) {
            $text = preg_replace(['/ {2,}/', '/ +([,.;:!?])/'], [' ', '$1'], $text) ?? $text;
            $text = trim($text);
        }

        return $text;
    }
}
