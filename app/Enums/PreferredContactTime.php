<?php

namespace App\Enums;

enum PreferredContactTime: string
{
    case Morning = 'morning';
    case Afternoon = 'afternoon';
    case Evening = 'evening';

    public function label(): string
    {
        return match ($this) {
            self::Morning => 'Morning',
            self::Afternoon => 'Afternoon',
            self::Evening => 'Evening',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Normalize API/UI input to a deduplicated list of valid time slugs.
     *
     * @param  mixed  $raw  array of strings, comma-separated string, or single slug
     * @return list<string>
     */
    public static function normalizeList(mixed $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }

        if (is_string($raw)) {
            $trimmed = trim($raw);
            if (
                (str_starts_with($trimmed, '[') || str_starts_with($trimmed, '{'))
                && ($decoded = json_decode($trimmed, true)) !== null
                && is_array($decoded)
            ) {
                $raw = $decoded;
            } else {
                $raw = str_contains($raw, ',') ? explode(',', $raw) : [$raw];
            }
        }

        if (! is_array($raw)) {
            $raw = [$raw];
        }

        $valid = self::values();
        $candidates = [];

        if ($raw !== [] && ! array_is_list($raw)) {
            foreach ($raw as $key => $value) {
                if (is_string($key) || is_int($key)) {
                    $candidates[] = (string) $key;
                }
                if (is_string($value) || is_int($value)) {
                    $candidates[] = (string) $value;
                }
            }
        } else {
            foreach ($raw as $value) {
                if (is_string($value) || is_int($value)) {
                    $candidates[] = (string) $value;
                }
            }
        }

        $normalized = [];

        foreach ($candidates as $item) {
            $slug = strtolower(trim($item));
            if ($slug === '' || ! in_array($slug, $valid, true)) {
                continue;
            }

            $normalized[$slug] = $slug;
        }

        return array_values($normalized);
    }
}
