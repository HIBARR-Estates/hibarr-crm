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
     * @return list<string>
     */
    public static function normalizeList(mixed $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }

        if ($raw instanceof self) {
            return [$raw->value];
        }

        if (is_string($raw)) {
            $trimmed = trim($raw);
            if ($trimmed === '') {
                return [];
            }

            if (str_starts_with($trimmed, '[')) {
                $decoded = json_decode($trimmed, true);

                return is_array($decoded) ? self::normalizeList($decoded) : [];
            }

            if (str_contains($raw, ',')) {
                return self::normalizeList(explode(',', $raw));
            }

            $raw = [$raw];
        }

        if (! is_array($raw)) {
            return [];
        }

        $valid = self::values();
        $normalized = [];

        foreach ($raw as $item) {
            if (! is_string($item) && ! is_int($item)) {
                continue;
            }

            $slug = strtolower(trim((string) $item));
            if ($slug === '' || ! in_array($slug, $valid, true)) {
                continue;
            }

            $normalized[$slug] = $slug;
        }

        return array_values($normalized);
    }
}
