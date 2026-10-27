<?php

namespace App\Jobs;

use App\Models\Deal;
use App\Models\Lead;
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

    public function __construct(
        public string $entityType, // 'lead' or 'deal'
        public int $entityId,
        public int $attempt = 0,
    ) {}

    public function handle(SallyInsightRetentionService $retention): void
    {
        try {
            if ($this->entityType === 'lead') {
                $retention->purgeForLead($this->entityId);
            } else {
                $retention->purgeForDeal($this->entityId);
            }
        } catch (\Throwable $e) {
            Log::warning('Sally insight retention retry failed', [
                'entity_type' => $this->entityType,
                'entity_id' => $this->entityId,
                'attempt' => $this->attempt,
                'error' => $e->getMessage(),
            ]);

            if ($this->attempt < 3) {
                $this->release(60 * ($this->attempt + 1));
            } else {
                Log::error('Sally insight retention permanently failed after retries', [
                    'entity_type' => $this->entityType,
                    'entity_id' => $this->entityId,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
