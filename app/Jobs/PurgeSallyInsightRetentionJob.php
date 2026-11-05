<?php

namespace App\Jobs;

use App\Services\SallyInsightRetentionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Retry a Sally insight purge that failed inside a Lead/Deal observer.
 * Runs after the deleting transaction has committed so it never blocks
 * the original delete, and retries with backoff if the purge fails again.
 */
class PurgeSallyInsightRetentionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Attempts before the queue marks the job failed. */
    public int $tries = 3;

    public function __construct(
        public string $entityType, // 'lead' or 'deal'
        public int $entityId,
    ) {
        // The observer runs inside the delete transaction; purging before the
        // commit could clean up a delete that then rolls back.
        $this->afterCommit();
    }

    /** Growing delay between attempts (seconds). */
    public function backoff(): array
    {
        return [60, 120, 180];
    }

    public function handle(SallyInsightRetentionService $retention): void
    {
        if ($this->entityType === 'lead') {
            $retention->purgeForLead($this->entityId);

            return;
        }

        $retention->purgeForDeal($this->entityId);
    }

    /** Final failure after every attempt has been used. */
    public function failed(\Throwable $e): void
    {
        Log::error('Sally insight retention permanently failed after retries', [
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'error' => $e->getMessage(),
        ]);
    }
}
