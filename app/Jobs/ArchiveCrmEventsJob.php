<?php

namespace App\Jobs;

use App\Models\CrmEvent;
use App\Models\CrmEventArchive;
use App\Models\CrmEventRetentionPolicy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Archives old CRM events based on retention policies.
 *
 * For each company with an active retention policy, this job identifies events
 * exceeding the max_age_days OR events beyond the max_row_count threshold
 * (oldest first), batch-inserts them into the archive table, and deletes
 * the originals.
 */
class ArchiveCrmEventsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 1;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 3600; // 1 hour — archival can be heavy

    /**
     * The chunk size for batch processing.
     */
    protected int $chunkSize = 1000;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $policies = CrmEventRetentionPolicy::withoutGlobalScopes()
            ->active()
            ->get();

        if ($policies->isEmpty()) {
            Log::info('ArchiveCrmEventsJob — No active retention policies found.');
            return;
        }

        foreach ($policies as $policy) {
            try {
                $this->archiveForCompany($policy);
            } catch (\Throwable $e) {
                Log::error('ArchiveCrmEventsJob — Failed for company.', [
                    'company_id' => $policy->company_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Archive events for a specific company based on their retention policy.
     */
    protected function archiveForCompany(CrmEventRetentionPolicy $policy): void
    {
        $companyId = $policy->company_id;
        $totalArchived = 0;

        // 1. Archive events exceeding max_age_days
        $ageThreshold = Carbon::now()->subDays($policy->max_age_days);
        $totalArchived += $this->archiveByCondition(
            $companyId,
            fn ($query) => $query->where('created_at', '<', $ageThreshold)
        );

        // 2. Archive events exceeding max_row_count (oldest first)
        $currentCount = CrmEvent::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->count();

        if ($currentCount > $policy->max_row_count) {
            $excessCount = $currentCount - $policy->max_row_count;
            $totalArchived += $this->archiveOldest($companyId, $excessCount);
        }

        // Update last_archived_at
        if ($totalArchived > 0) {
            $policy->update(['last_archived_at' => now()]);

            Log::info('ArchiveCrmEventsJob — Archived events.', [
                'company_id' => $companyId,
                'total_archived' => $totalArchived,
            ]);
        }
    }

    /**
     * Archive events matching a condition, processing in chunks.
     *
     * @param int      $companyId
     * @param callable $condition A callback that receives the query builder.
     * @return int Number of archived records.
     */
    protected function archiveByCondition(int $companyId, callable $condition): int
    {
        $totalArchived = 0;

        do {
            $events = CrmEvent::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->tap($condition)
                ->orderBy('id', 'asc')
                ->limit($this->chunkSize)
                ->get();

            if ($events->isEmpty()) {
                break;
            }

            $this->moveToArchive($events);
            $totalArchived += $events->count();

        } while ($events->count() === $this->chunkSize);

        return $totalArchived;
    }

    /**
     * Archive the N oldest events for a company.
     */
    protected function archiveOldest(int $companyId, int $count): int
    {
        $totalArchived = 0;
        $remaining = $count;

        while ($remaining > 0) {
            $batchSize = min($remaining, $this->chunkSize);

            $events = CrmEvent::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->orderBy('id', 'asc')
                ->limit($batchSize)
                ->get();

            if ($events->isEmpty()) {
                break;
            }

            $this->moveToArchive($events);
            $totalArchived += $events->count();
            $remaining -= $events->count();
        }

        return $totalArchived;
    }

    /**
     * Move a collection of events to the archive table within a transaction.
     */
    protected function moveToArchive(\Illuminate\Database\Eloquent\Collection $events): void
    {
        DB::transaction(function () use ($events) {
            // Batch insert into archive
            $archiveRows = $events->map(function (CrmEvent $event) {
                return [
                    'uuid' => $event->uuid,
                    'company_id' => $event->company_id,
                    'event_type_id' => $event->event_type_id,
                    'generation_type' => $event->getRawOriginal('generation_type'),
                    'user_id' => $event->user_id,
                    'model_type' => $event->model_type,
                    'model_id' => $event->model_id,
                    'correlation_id' => $event->correlation_id,
                    'causation_id' => $event->causation_id,
                    'source' => $event->getRawOriginal('source'),
                    'ip_address' => $event->ip_address,
                    'user_agent' => $event->user_agent,
                    'metadata' => is_array($event->metadata) ? json_encode($event->metadata) : $event->metadata,
                    'occurred_at' => $event->occurred_at,
                    'created_at' => $event->created_at,
                    'updated_at' => $event->updated_at,
                    'archived_at' => now(),
                ];
            })->toArray();

            CrmEventArchive::insert($archiveRows);

            // Delete originals
            CrmEvent::withoutGlobalScopes()
                ->whereIn('id', $events->pluck('id'))
                ->delete();
        });
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ArchiveCrmEventsJob — Job failed.', [
            'error' => $exception->getMessage(),
        ]);
    }
}
