<?php

namespace App\Console\Commands;

use App\Jobs\ArchiveCrmEventsJob;
use Illuminate\Console\Command;

/**
 * Artisan command to trigger CRM event archival.
 *
 * Dispatches the ArchiveCrmEventsJob which processes all active retention
 * policies and archives qualifying events.
 *
 * Usage:
 *   php artisan crm:archive-events          # Dispatch to queue
 *   php artisan crm:archive-events --sync   # Run synchronously
 */
class ArchiveCrmEventsCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'crm:archive-events {--sync : Run synchronously instead of dispatching to queue}';

    /**
     * The console command description.
     */
    protected $description = 'Archive old CRM events based on retention policies';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting CRM event archival...');

        if ($this->option('sync')) {
            $this->info('Running synchronously...');
            (new ArchiveCrmEventsJob())->handle();
        } else {
            ArchiveCrmEventsJob::dispatch();
            $this->info('Archival job dispatched to queue.');
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}
