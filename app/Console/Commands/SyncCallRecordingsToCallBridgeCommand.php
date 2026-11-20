<?php

namespace App\Console\Commands;

use App\Jobs\SyncCallRecordingToCallBridgeJob;
use App\Models\CallRecording;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Re-sends recordings OL has not confirmed yet.
 *
 * The upload dispatches SyncCallRecordingToCallBridgeJob once. On a real queue
 * that job retries itself, but on the `sync` connection (the config fallback)
 * one failure would be final. This sweep, run by the scheduler, makes every
 * failed registration recoverable either way: anything still without
 * `ol_synced_at` is tried again until it is stored or ages out.
 */
class SyncCallRecordingsToCallBridgeCommand extends Command
{
    protected $signature = 'call-recordings:sync-to-call-bridge
        {--days=7 : Only retry recordings uploaded in the last N days}
        {--limit=50 : Maximum recordings per run}';

    protected $description = 'Retry registering call recordings with OL\'s call bridge';

    public function handle(): int
    {
        $ids = CallRecording::withoutGlobalScopes()
            ->whereNull('ol_synced_at')
            ->whereNotNull('call_ref')
            ->where('created_at', '>=', now()->subDays(max(1, (int) $this->option('days'))))
            // Leave the upload's own dispatch a head start.
            ->where('created_at', '<=', now()->subMinutes(5))
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->orderBy('id')
            ->limit(max(1, (int) $this->option('limit')))
            ->pluck('id');

        $synced = 0;
        foreach ($ids as $id) {
            try {
                // Run here, not queued: this sweep is the retry path for when
                // no worker is draining the queue.
                SyncCallRecordingToCallBridgeJob::dispatchSync((int) $id);
                $synced++;
            } catch (\Throwable $e) {
                Log::warning('call-recordings:sync-to-call-bridge: retry failed', [
                    'recording_id' => $id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info(sprintf('Tried %d recording(s); %d without error.', $ids->count(), $synced));

        return self::SUCCESS;
    }
}
