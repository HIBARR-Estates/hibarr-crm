<?php

namespace App\Console\Commands;

use App\Services\Migration\CrmInventoryReportBuilder;
use App\Services\Migration\CrmInventoryReportPresenter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Read-only CRM data inventory for migration sizing (ADR-0007).
 * Prefer --connection=mysql_replica against a prod read replica / SELECT-only user.
 */
class MigrationInventoryReportCommand extends Command
{
    protected $signature = 'migration:inventory-report
                            {--company= : Limit counts to one company_id}
                            {--format=table : table|json|markdown}
                            {--output= : Write report to this file path}
                            {--connection= : DB connection name (default: mysql_replica when DB_REPLICA_HOST is set)}
                            {--env-label= : Environment label stamped into the report (default APP_ENV)}
                            {--section=* : entities, duplicates, and/or usage (default: all)}';

    protected $description = 'Read-only CRM record counts for migration inventory (no mutations; counts only)';

    public function handle(CrmInventoryReportPresenter $presenter): int
    {
        $format = strtolower((string) $this->option('format'));
        if (! in_array($format, ['table', 'json', 'markdown'], true)) {
            $this->error('Invalid --format. Expected table, json, or markdown.');

            return self::FAILURE;
        }

        $sections = $this->resolveSections();
        if ($sections === null) {
            return self::FAILURE;
        }

        $companyOption = $this->option('company');
        $companyId = $companyOption === null || $companyOption === ''
            ? null
            : (int) $companyOption;

        [$connection, $connectionWarning] = $this->resolveConnection();
        $environment = (string) ($this->option('env-label') ?: config('app.env', 'local'));

        $builder = new CrmInventoryReportBuilder($connection, $companyId);
        $report = $builder->build($sections, $environment);

        if ($connectionWarning !== null) {
            array_unshift($report['warnings'], $connectionWarning);
        }

        $body = $presenter->present($report, $format);
        $outputPath = $this->option('output');

        if ($outputPath) {
            File::put((string) $outputPath, $body);
            $this->info('Wrote inventory report to '.$outputPath);
            if ($format === 'table') {
                $this->line($body);
            }
        } else {
            $this->line($body);
        }

        return self::SUCCESS;
    }

    /**
     * @return list<string>|null
     */
    private function resolveSections(): ?array
    {
        /** @var list<string> $requested */
        $requested = array_values(array_filter((array) $this->option('section')));
        if ($requested === []) {
            return ['entities', 'duplicates', 'usage'];
        }

        $allowed = ['entities', 'duplicates', 'usage'];
        $sections = [];
        foreach ($requested as $section) {
            $section = strtolower((string) $section);
            if (! in_array($section, $allowed, true)) {
                $this->error("Unknown --section: {$section}. Expected entities, duplicates, usage.");

                return null;
            }
            $sections[] = $section;
        }

        return array_values(array_unique($sections));
    }

    /**
     * @return array{0: string, 1: string|null}
     */
    private function resolveConnection(): array
    {
        $explicit = $this->option('connection');
        if (is_string($explicit) && $explicit !== '') {
            return [$explicit, null];
        }

        $replicaHost = env('DB_REPLICA_HOST');
        if (is_string($replicaHost) && $replicaHost !== '') {
            return ['mysql_replica', null];
        }

        $default = (string) config('database.default', 'mysql');

        return [
            $default,
            'DB_REPLICA_HOST unset; using default connection "'.$default.'" — prefer mysql_replica for production inventory runs',
        ];
    }
}
