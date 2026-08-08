<?php

namespace App\Jobs;

use App\Models\DealFollowUp;
use App\Scopes\ActiveScope;
use App\Scopes\CompanyScope;
use App\Services\CalendarSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class SyncCalendarEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 30;

    public function __construct(private readonly int $followUpId)
    {
    }

    public function handle(CalendarSyncService $syncService): void
    {
        $followUp = DealFollowUp::query()
            ->with([
                'meetingType',
                'lead' => fn ($query) => $query->withoutGlobalScope(CompanyScope::class),
                'deal' => fn ($query) => $query
                    ->withoutGlobalScope(CompanyScope::class)
                    ->with([
                        'contact' => fn ($contactQuery) => $contactQuery->withoutGlobalScope(CompanyScope::class),
                        'leadAgent.user' => fn ($userQuery) => $userQuery->withoutGlobalScope(ActiveScope::class),
                    ]),
            ])
            ->find($this->followUpId);

        if (!$followUp) {
            Log::warning('SyncCalendarEventJob: follow-up not found', [
                'follow_up_id' => $this->followUpId,
            ]);
            return;
        }

        try {
            $jobId = $syncService->enqueueEvent($followUp, CalendarSyncService::PLATFORM_ZOHO);

            if ($jobId) {
                $followUp->updateQuietly([
                    'zoho_calendar_job_id' => $jobId,
                    'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
                ]);
            } else {
                $followUp->updateQuietly([
                    'zoho_calendar_job_id' => null,
                    'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_FAILED,
                ]);
            }
        } catch (Throwable $e) {
            Log::error('SyncCalendarEventJob failed', [
                'follow_up_id' => $this->followUpId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $followUp->updateQuietly([
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
            Log::error('SyncCalendarEventJob.failed failed to persist', [
                'follow_up_id' => $this->followUpId,
                'error' => $e->getMessage(),
            ]);
        }

        Log::error('SyncCalendarEventJob exhausted retries', [
            'follow_up_id' => $this->followUpId,
            'error' => $exception->getMessage(),
        ]);
    }
}
