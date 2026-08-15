<?php

namespace App\Support;

/**
 * Builds concise entity-activity email / in-app copy with a prominent detail block
 * (deal name, meeting date, task title) and minimal supplemental content.
 */
class EntityActivityMailBuilder
{
    public static function renderDetailBlock(
        ?string $title = null,
        ?string $meta = null,
        ?string $subtext = null,
        bool $warning = false,
    ): string {
        if ($title === null && $meta === null && $subtext === null) {
            return '';
        }

        $html = '<div class="detail-block">';

        if ($title !== null && $title !== '') {
            $html .= '<div class="detail-title">'.e($title).'</div>';
        }

        if ($meta !== null && $meta !== '') {
            $html .= '<div class="detail-meta">'.e($meta).'</div>';
        }

        if ($subtext !== null && $subtext !== '') {
            $class = $warning ? 'detail-meta detail-warning' : 'detail-meta';
            $html .= '<div class="'.$class.'">'.e($subtext).'</div>';
        }

        $html .= '</div>';

        return $html;
    }

    /**
     * @return array{date: string, time: string|null}|null
     */
    public static function splitDateAndTime(string $formatted): ?array
    {
        $formatted = trim($formatted);
        if ($formatted === '') {
            return null;
        }

        if (preg_match('/^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/', $formatted, $matches)) {
            return [
                'date' => trim($matches[1]),
                'time' => trim($matches[2]),
            ];
        }

        return [
            'date' => $formatted,
            'time' => null,
        ];
    }

    public static function formatDateTimeTitle(?string $date, ?string $time): ?string
    {
        if ($date === null || $date === '') {
            return null;
        }

        if ($time !== null && $time !== '') {
            return $date.' · '.$time;
        }

        return $date;
    }

    public static function supplementalLine(string $label, string $value): string
    {
        if ($value === '') {
            return '';
        }

        return '<strong>'.e($label).':</strong> '.e($value);
    }

    /**
     * @param  array<int, string>  $lines
     */
    public static function joinSupplemental(array $lines): string
    {
        return collect($lines)
            ->filter(fn (string $line): bool => trim(strip_tags($line)) !== '')
            ->implode('<br>');
    }
}
