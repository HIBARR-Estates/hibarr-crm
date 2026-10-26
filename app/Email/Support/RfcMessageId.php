<?php

namespace App\Email\Support;

/**
 * RFC 5322 message ids stay plain strings; this only puts them in one
 * canonical shape ("<id@host>") so thread matching compares like with like.
 */
class RfcMessageId
{
    public static function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $id = trim($value);

        if (preg_match('/<([^<>\s]+)>/', $id, $match) === 1) {
            $id = $match[1];
        }

        $id = trim($id, " \t\r\n<>");

        if ($id === '' || preg_match('/\s/', $id) === 1) {
            return null;
        }

        return "<{$id}>";
    }

    /**
     * Parse an In-Reply-To / References header (or an already-split list)
     * into unique normalized ids, in their original order.
     *
     * @param  string|iterable<mixed>|null  $value
     * @return list<string>
     */
    public static function parseList(string|iterable|null $value): array
    {
        if ($value === null) {
            return [];
        }

        if (is_string($value)) {
            preg_match_all('/<[^<>\s]+>/', $value, $matches);
            $candidates = $matches[0] !== [] ? $matches[0] : (preg_split('/[\s,]+/', trim($value)) ?: []);
        } else {
            $candidates = $value;
        }

        $ids = [];

        foreach ($candidates as $candidate) {
            $id = is_string($candidate) ? self::normalize($candidate) : null;

            if ($id !== null && ! in_array($id, $ids, true)) {
                $ids[] = $id;
            }
        }

        return $ids;
    }
}
