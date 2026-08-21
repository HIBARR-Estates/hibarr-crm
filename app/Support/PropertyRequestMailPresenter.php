<?php

namespace App\Support;

use App\Models\Property;

/**
 * Shared HTML fragments for property workflow request emails (Plunk + SMTP).
 */
class PropertyRequestMailPresenter
{
    public static function propertyMeta(Property $property, bool $withLocation = true): string
    {
        $lines = [
            '<strong>Property:</strong> '.self::escape($property->display_title),
            '<strong>Reference:</strong> '.self::escape((string) ($property->reference_code ?? '')),
        ];

        if ($withLocation) {
            $location = trim(
                implode(', ', array_filter([(string) ($property->city ?? ''), (string) ($property->area ?? '')])),
                ', '
            );
            $lines[] = '<strong>Location:</strong> '.self::escape($location !== '' ? $location : 'N/A');
        }

        return implode('<br>', $lines);
    }

    public static function line(string $label, ?string $value): string
    {
        if ($value === null || trim($value) === '') {
            return '';
        }

        return '<strong>'.self::escape($label).':</strong> '.self::escape($value);
    }

    public static function denyLink(string $url, string $label = 'Deny Request'): string
    {
        if ($url === '') {
            return '';
        }

        return '<br><br><a href="'.self::escape($url).'" style="color:#003160;text-decoration:underline;font-family:\'DM Mono\',Consolas,monospace;font-size:14px">'
            .self::escape($label).'</a>';
    }

    public static function joinBlocks(string ...$blocks): string
    {
        return implode('<br>', array_values(array_filter($blocks, fn ($block) => trim($block) !== '')));
    }

    private static function escape(?string $value): string
    {
        return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
    }
}
