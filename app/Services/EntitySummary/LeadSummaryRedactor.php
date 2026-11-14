<?php

namespace App\Services\EntitySummary;

use App\Models\Lead;

/**
 * Strips personally identifying details out of free text before it is sent to
 * the lead-summary model.
 *
 * The summary needs to know what a lead said and wants, never who they are or
 * how to reach them. Structured PII (name, email, phone, DOB, address) is simply
 * never added to the payload; this class covers the places PII can still leak
 * in through free text — notes, qualification answers, custom fields and the
 * deal agent's own prose.
 */
final class LeadSummaryRedactor
{
    public const NAME_PLACEHOLDER = '[name]';

    private const EMAIL_PATTERN = '/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i';

    /** A run of digits with common phone separators; filtered by digit count below. */
    private const PHONE_PATTERN = '/(?<![\w.])[(+]?\d[\d\s().\-]{5,}\d(?![\w])/';

    /** @var list<string> */
    private array $knownTerms;

    /**
     * @param  list<string|null>  $knownTerms  Identifiers of this lead (name, company, …) to mask wherever they appear.
     */
    public function __construct(array $knownTerms = [])
    {
        $terms = [];

        foreach ($knownTerms as $term) {
            $term = trim((string) $term);

            if ($term === '') {
                continue;
            }

            $terms[] = $term;

            // Whole value plus each word of it, so "Jane Doe" also masks a lone "Jane".
            foreach (preg_split('/[\s,.;:()\-]+/u', $term) ?: [] as $part) {
                if (mb_strlen($part) >= 3) {
                    $terms[] = $part;
                }
            }
        }

        // Longest first so "Jane Doe" is masked before "Jane" is.
        $terms = array_values(array_unique($terms));
        usort($terms, fn (string $a, string $b) => mb_strlen($b) <=> mb_strlen($a));

        $this->knownTerms = $terms;
    }

    public static function forLead(Lead $lead): self
    {
        return new self([
            $lead->client_name,
            $lead->company_name,
            $lead->client_email,
            $lead->mobile,
            $lead->cell,
            $lead->office,
        ]);
    }

    /**
     * Mask PII in plain text.
     */
    public function redact(?string $text): string
    {
        $text = (string) $text;

        if ($text === '') {
            return '';
        }

        $text = preg_replace(self::EMAIL_PATTERN, '[email]', $text) ?? $text;

        $text = preg_replace_callback(self::PHONE_PATTERN, function (array $match) {
            // Dates ("2026-06-23", "23.06.2026") are facts the summary needs, not phone numbers.
            if (preg_match('/\d{4}-\d{2}-\d{2}|\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}/', $match[0])) {
                return $match[0];
            }

            $digits = preg_match_all('/\d/', $match[0]);

            // Anything international ("+90 …") or long enough to be a phone number.
            // 7-8 plain digits with spaces are far more likely a budget ("1 500 000").
            if (str_contains($match[0], '+') ? $digits >= 7 : $digits >= 9) {
                return '[phone]';
            }

            return $match[0];
        }, $text) ?? $text;

        foreach ($this->knownTerms as $term) {
            $text = preg_replace(
                '/(?<![\p{L}\p{N}])'.preg_quote($term, '/').'(?![\p{L}\p{N}])/iu',
                self::NAME_PLACEHOLDER,
                $text
            ) ?? $text;
        }

        return $text;
    }

    /**
     * Strip HTML, normalise whitespace, redact PII and cap the length.
     */
    public function clean(?string $html, int $maxChars = 600): string
    {
        $html = (string) $html;

        if ($html === '') {
            return '';
        }

        // Cap BEFORE strip_tags — unbounded note HTML OOMs during sanitize.
        $html = mb_substr($html, 0, 5000);

        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

        return mb_substr($this->redact($text), 0, $maxChars);
    }
}
