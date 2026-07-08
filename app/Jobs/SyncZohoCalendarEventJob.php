<?php

namespace App\Jobs;

use App\Models\DealFollowUp;
use App\Services\ZohoCalendarSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class SyncZohoCalendarEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;

    public function __construct(private readonly int $followUpId)
    {
    }

    public function handle(ZohoCalendarSyncService $syncService): void
    {
        $followUp = DealFollowUp::query()
            ->with(['meetingType', 'deal'])
            ->find($this->followUpId);

        if (!$followUp) {
            Log::warning('SyncZohoCalendarEventJob: follow-up not found', [
                'follow_up_id' => $this->followUpId,
            ]);
            return;
        }

        try {
            $jobId = $syncService->enqueueEvent($followUp);

            if ($jobId) {
                $followUp->update([
                    'zoho_calendar_job_id' => $jobId,
                    'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
                ]);
            } else {
                $followUp->update([
                    'zoho_calendar_job_id' => null,
                    'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
                ]);
            }
        } catch (Throwable $e) {
            Log::error('SyncZohoCalendarEventJob failed', [
                'follow_up_id' => $this->followUpId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $followUp->update([
                'zoho_calendar_job_id' => null,
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            ]);
        }
    }

    public function failed(Throwable $exception): void
    {
        try {
            DealFollowUp::where('id', $this->followUpId)->update([
                'zoho_calendar_job_id' => null,
                'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
            ]);
        } catch (Throwable $e) {
            Log::error('SyncZohoCalendarEventJob.failed failed to persist', [
                'follow_up_id' => $this->followUpId,
                'error' => $e->getMessage(),
            ]);
        }

        Log::error('SyncZohoCalendarEventJob exhausted retries', [
            'follow_up_id' => $this->followUpId,
            'error' => $exception->getMessage(),
        ]);
    }
}

