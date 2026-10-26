<?php

namespace App\Email\Jobs;

use App\Email\EmailFeature;
use App\Email\Models\EmailConnection;
use App\Email\Sync\MailboxSynchronizer;
use App\Email\Sync\SyncOutcome;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;

/**
 * Syncs one mailbox. Runs on the dedicated email-sync queue so mail never
 * waits behind, or starves, the default workers.
 */
class SyncMailboxJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /** Provider trouble is recorded on the connection and retried by the next scheduled run, not by the queue. */
    public int $tries = 1;

    public int $timeout = 300;

    public function __construct(public readonly int $connectionId)
    {
        $this->onQueue((string) config('email.queues.sync', 'email-sync'));
    }

    /**
     * @return list<object>
     */
    public function middleware(): array
    {
        // One sync per mailbox at a time; a second one is dropped, not queued behind.
        return [
            (new WithoutOverlapping("email-sync:{$this->connectionId}"))->dontRelease()->expireAfter($this->timeout + 60),
        ];
    }

    public function handle(MailboxSynchronizer $synchronizer): SyncOutcome
    {
        // Checked before touching the database so a disabled feature does nothing at all.
        if (! EmailFeature::enabled()) {
            return SyncOutcome::skipped('feature_disabled');
        }

        // No logged-in user in a worker, so the company scope does not apply here.
        $connection = EmailConnection::withoutGlobalScopes()->find($this->connectionId);

        if ($connection === null) {
            return SyncOutcome::skipped('connection_missing');
        }

        return $synchronizer->sync($connection);
    }
}
