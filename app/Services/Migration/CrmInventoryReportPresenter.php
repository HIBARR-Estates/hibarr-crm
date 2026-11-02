<?php

namespace App\Services\Migration;

/**
 * Formats CRM inventory reports for stdout / file (counts only; no PII).
 */
class CrmInventoryReportPresenter
{
    /**
     * @param  array<string, mixed>  $report
     */
    public function present(array $report, string $format): string
    {
        return match ($format) {
            'json' => $this->toJson($report),
            'markdown' => $this->toMarkdown($report),
            default => $this->toTable($report),
        };
    }

    /**
     * @param  array<string, mixed>  $report
     */
    public function toJson(array $report): string
    {
        return json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n";
    }

    /**
     * Plain-text tables suitable for Artisan console / log capture.
     *
     * @param  array<string, mixed>  $report
     */
    public function toTable(array $report): string
    {
        $lines = [];
        $lines[] = sprintf(
            'CRM inventory report v%d — %s — %s',
            (int) ($report['report_version'] ?? 0),
            (string) ($report['environment'] ?? ''),
            (string) ($report['generated_at'] ?? ''),
        );
        $db = $report['database'] ?? [];
        $lines[] = sprintf(
            'connection=%s host=%s company_id=%s',
            (string) ($db['connection'] ?? ''),
            (string) ($db['host'] ?? ''),
            json_encode($report['scope']['company_id'] ?? null),
        );
        $lines[] = '';

        $lines[] = '=== entities ===';
        foreach ($report['entities'] ?? [] as $row) {
            $lines[] = $this->formatMetricRow($row);
        }

        $lines[] = '';
        $lines[] = '=== duplicates ===';
        foreach ($report['duplicates'] ?? [] as $row) {
            $lines[] = $this->formatMetricRow($row);
        }

        $lines[] = '';
        $lines[] = '=== usage ===';
        foreach ($report['usage'] ?? [] as $row) {
            $lines[] = $this->formatMetricRow($row);
        }

        if (! empty($report['warnings'])) {
            $lines[] = '';
            $lines[] = '=== warnings ===';
            foreach ($report['warnings'] as $warning) {
                $lines[] = '- '.$warning;
            }
        }

        if (! empty($report['timings_ms'])) {
            $lines[] = '';
            $lines[] = '=== timings_ms ===';
            foreach ($report['timings_ms'] as $section => $ms) {
                $lines[] = sprintf('%s: %dms', $section, $ms);
            }
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * Markdown fragment for ADR-0007 (counts only).
     *
     * @param  array<string, mixed>  $report
     */
    public function toMarkdown(array $report): string
    {
        $db = $report['database'] ?? [];
        $lines = [];
        $lines[] = sprintf(
            '### CRM inventory (%s, %s)',
            (string) ($report['environment'] ?? ''),
            (string) ($report['generated_at'] ?? ''),
        );
        $lines[] = '';
        $lines[] = sprintf(
            '_connection=`%s` host=`%s` company_id=`%s` report_version=%d_',
            (string) ($db['connection'] ?? ''),
            (string) ($db['host'] ?? ''),
            json_encode($report['scope']['company_id'] ?? null),
            (int) ($report['report_version'] ?? 0),
        );
        $lines[] = '';

        $lines[] = '#### Entities';
        $lines[] = '';
        $lines[] = '| Key | Metrics | Notes |';
        $lines[] = '|-----|---------|-------|';
        foreach ($report['entities'] ?? [] as $row) {
            $lines[] = sprintf(
                '| `%s` | %s | %s |',
                $row['key'] ?? '',
                $this->metricsInline($row['metrics'] ?? []),
                $this->escapeCell((string) ($row['notes'] ?? '')),
            );
        }

        $lines[] = '';
        $lines[] = '#### Duplicates';
        $lines[] = '';
        $lines[] = '| Key | Duplicate groups | Extra rows |';
        $lines[] = '|-----|------------------|------------|';
        foreach ($report['duplicates'] ?? [] as $row) {
            $metrics = $row['metrics'] ?? [];
            $lines[] = sprintf(
                '| `%s` | %s | %s |',
                $row['key'] ?? '',
                $metrics['duplicate_groups'] ?? 0,
                $metrics['extra_rows'] ?? 0,
            );
        }

        $lines[] = '';
        $lines[] = '#### Sparse / unused';
        $lines[] = '';
        $lines[] = '| Key | Metrics | Notes |';
        $lines[] = '|-----|---------|-------|';
        foreach ($report['usage'] ?? [] as $row) {
            $lines[] = sprintf(
                '| `%s` | %s | %s |',
                $row['key'] ?? '',
                $this->metricsInline($row['metrics'] ?? []),
                $this->escapeCell((string) ($row['notes'] ?? '')),
            );
        }

        if (! empty($report['warnings'])) {
            $lines[] = '';
            $lines[] = '#### Warnings';
            $lines[] = '';
            foreach ($report['warnings'] as $warning) {
                $lines[] = '- '.$warning;
            }
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * @param  array{key?: string, metrics?: array<string, mixed>, notes?: string|null}  $row
     */
    private function formatMetricRow(array $row): string
    {
        $notes = isset($row['notes']) && $row['notes'] !== '' && $row['notes'] !== null
            ? ' — '.$row['notes']
            : '';

        return sprintf(
            '%s: %s%s',
            $row['key'] ?? '?',
            $this->metricsInline($row['metrics'] ?? []),
            $notes,
        );
    }

    /**
     * @param  array<string, mixed>  $metrics
     */
    private function metricsInline(array $metrics): string
    {
        $parts = [];
        foreach ($metrics as $k => $v) {
            if (is_array($v)) {
                $inner = [];
                foreach ($v as $ik => $iv) {
                    $inner[] = $ik.'='.$iv;
                }
                $parts[] = $k.'={'.implode(', ', $inner).'}';
            } else {
                $parts[] = $k.'='.$v;
            }
        }

        return implode(', ', $parts);
    }

    private function escapeCell(string $value): string
    {
        return str_replace('|', '\\|', $value);
    }
}
