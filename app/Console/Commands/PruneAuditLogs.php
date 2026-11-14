<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

/**
 * Removes audit log rows older than config('audit-log.retention_days').
 * With retention at 0 (the default) everything is kept and this is a no-op.
 *
 * Usage:
 *   php artisan audit-log:prune
 *   php artisan audit-log:prune --days=365
 */
class PruneAuditLogs extends Command
{
    protected $signature = 'audit-log:prune {--days= : Override the configured retention in days}';

    protected $description = 'Delete audit log entries older than the retention period';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?? config('audit-log.retention_days', 0));

        if ($days <= 0) {
            $this->info('Audit log retention is unlimited; nothing pruned.');

            return self::SUCCESS;
        }

        $cutoff = now()->subDays($days);
        $deleted = 0;

        // Chunked so a large backlog never holds one long lock on the table.
        do {
            $batch = AuditLog::where('created_at', '<', $cutoff)->limit(5000)->delete();
            $deleted += $batch;
        } while ($batch > 0);

        $this->info("Pruned {$deleted} audit log entries older than {$days} days.");

        return self::SUCCESS;
    }
}
