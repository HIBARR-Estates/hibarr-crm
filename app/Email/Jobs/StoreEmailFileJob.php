<?php

namespace App\Email\Jobs;

use App\Email\EmailFeature;
use App\Email\Files\EmailFiles;
use App\Email\Models\EmailFile;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Fetches one received attachment from the provider and stores it, after the
 * message itself is already in the CRM. A file that cannot be had is marked
 * unavailable; the message stays as it is.
 */
class StoreEmailFileJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;

    public int $timeout = 300;

    public function __construct(public readonly int $fileId)
    {
        $this->onQueue((string) config('email.queues.sync', 'email-sync'));
        // The file row is written inside the ingest transaction; wait for it to exist.
        $this->afterCommit();
    }

    public function handle(EmailFiles $files): void
    {
        if (! EmailFeature::enabled()) {
            return;
        }

        $file = EmailFile::withoutGlobalScopes()->find($this->fileId);

        if ($file !== null) {
            $files->fetchAndStore($file);
        }
    }
}
