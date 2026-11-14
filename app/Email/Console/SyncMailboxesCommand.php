<?php

namespace App\Email\Console;

use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Models\EmailConnection;
use Illuminate\Console\Command;

/**
 * Enqueues one sync job per active mailbox. The job itself fail-closes on the
 * flag, allowlist, and connection status. Provider errors are recorded on the
 * connection and retried on the next run.
 */
class SyncMailboxesCommand extends Command
{
    protected $signature = 'email:sync-mailboxes';

    protected $description = 'Dispatch a sync job for every active mailbox connection';

    public function handle(): int
    {
        if (! EmailFeature::enabled()) {
            $this->info('Skipped: crm.email is off.');

            return self::SUCCESS;
        }

        $ids = EmailConnection::withoutGlobalScopes()
            ->where('status', ConnectionStatus::Active)
            ->orderBy('id')
            ->pluck('id');

        foreach ($ids as $id) {
            SyncMailboxJob::dispatch((int) $id);
        }

        $this->info('Dispatched '.$ids->count().' mailbox sync job(s).');

        return self::SUCCESS;
    }
}
