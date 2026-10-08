<?php

namespace App\Email\Jobs;

use App\Email\EmailFeature;
use App\Email\Files\EmailFiles;
use App\Email\Models\EmailFile;
use App\Email\Observability\EmailLog;
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
        $started = microtime(true);

        if (! EmailFeature::enabled()) {
            EmailLog::metric('email.job.file_store', [
                'file_row_id' => $this->fileId,
                'skipped' => 'feature_disabled',
                'duration_ms' => 0,
            ]);

            return;
        }

        $file = EmailFile::withoutGlobalScopes()->find($this->fileId);

        if ($file === null) {
            EmailLog::metric('email.job.file_store', [
                'file_row_id' => $this->fileId,
                'skipped' => 'file_missing',
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
            ]);

            return;
        }

        $files->fetchAndStore($file);
        $file->refresh();

        EmailLog::metric('email.job.file_store', [
            'file_id' => $file->uuid,
            'company_id' => $file->company_id,
            'scan_status' => $file->scan_status->value,
            'duration_ms' => (int) round((microtime(true) - $started) * 1000),
        ]);
    }
}
