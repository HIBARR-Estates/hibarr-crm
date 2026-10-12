<?php

namespace App\Email\Support;

use App\Email\Data\EmailAddress;
use DateTimeImmutable;
use Throwable;

/**
 * The header block of a raw RFC 5322 message. Reads headers only — bodies
 * and attachments come from the provider's own endpoints.
 */
class RfcHeaders
{
    /**
     * @param  array<string, list<string>>  $headers  lower-cased name => values, in order
     */
    private function __construct(private readonly array $headers) {}

    public static function parse(string $raw): self
    {
        // Headers end at the first blank line.
        $block = preg_split('/\r?\n\r?\n/', ltrim($raw, "\r\n"), 2)[0] ?? '';
        // Unfold continuation lines (a line starting with whitespace continues the previous one).
        $block = (string) preg_replace('/\r?\n[ \t]+/', ' ', $block);

        $headers = [];

        foreach (preg_split('/\r?\n/', $block) ?: [] as $line) {
            if (preg_match('/^([!-9;-~]+):[ \t]*(.*)$/', $line, $match) === 1) {
                $headers[strtolower($match[1])][] = trim($match[2]);
            }
        }

        return new self($headers);
    }

    /** First value of a header, with encoded words (=?UTF-8?…?=) decoded. Null when absent or empty. */
    public function get(string $name): ?string
    {
        $value = $this->headers[strtolower($name)][0] ?? null;

        if ($value === null || $value === '') {
            return null;
        }

        return self::decode($value);
    }

    /** Raw first value, for headers that are identifiers rather than text. */
    public function raw(string $name): ?string
    {
        $value = $this->headers[strtolower($name)][0] ?? null;

        return $value === '' ? null : $value;
    }

    /**
     * @return list<EmailAddress>
     */
    public function addresses(string $name): array
    {
        $entries = [];

        foreach ($this->headers[strtolower($name)] ?? [] as $value) {
            foreach (self::splitAddressList($value) as $entry) {
                $entries[] = self::decode($entry);
            }
        }

        return EmailAddress::listFrom($entries);
    }

    public function address(string $name): ?EmailAddress
    {
        return $this->addresses($name)[0] ?? null;
    }

    public function date(string $name = 'Date'): ?DateTimeImmutable
    {
        $value = $this->raw($name);

        if ($value === null) {
            return null;
        }

        // Drop a trailing comment such as "(UTC)".
        $value = trim((string) preg_replace('/\s*\([^)]*\)\s*$/', '', $value));

        try {
            return new DateTimeImmutable($value);
        } catch (Throwable) {
            return null;
        }
    }

    public function has(string $name): bool
    {
        return isset($this->headers[strtolower($name)]);
    }

    /**
     * Split "A <a@x>, \"B, C\" <b@x>" on the commas that separate addresses,
     * not the ones inside quotes or angle brackets.
     *
     * @return list<string>
     */
    private static function splitAddressList(string $value): array
    {
        $parts = [];
        $current = '';
        $quoted = false;
        $angle = 0;

        foreach (str_split($value) as $index => $char) {
            if ($char === '"' && ($index === 0 || $value[$index - 1] !== '\\')) {
                $quoted = ! $quoted;
            } elseif (! $quoted && $char === '<') {
                $angle++;
            } elseif (! $quoted && $char === '>') {
                $angle = max(0, $angle - 1);
            }

            if ($char === ',' && ! $quoted && $angle === 0) {
                $parts[] = $current;
                $current = '';

                continue;
            }

            $current .= $char;
        }

        $parts[] = $current;

        return array_values(array_filter(array_map('trim', $parts), fn (string $part): bool => $part !== ''));
    }

    private static function decode(string $value): string
    {
        if (! str_contains($value, '=?')) {
            return $value;
        }

        $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');

        return is_string($decoded) && $decoded !== '' ? $decoded : $value;
    }
}
