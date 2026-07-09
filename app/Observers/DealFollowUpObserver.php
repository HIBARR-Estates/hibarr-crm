<?php

namespace App\Observers;

use App\Models\EmployeeDetails;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Services\DealActivityEventService;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\Log;
use App\Jobs\SyncZohoCalendarEventJob;

class DealFollowUpObserver
{
    protected DealAutomationService $dealAutomation;
    protected DealNotificationService $notificationService;
    protected DealActivityEventService $dealActivityEventService;

    public function __construct(
        DealAutomationService $dealAutomation,
        DealNotificationService $notificationService,
        DealActivityEventService $dealActivityEventService
    ) {
        $this->dealAutomation = $dealAutomation;
        $this->notificationService = $notificationService;
        $this->dealActivityEventService = $dealActivityEventService;
    }

    /**
     * Handle the DealFollowUp "created" event.
     */
    public function created(DealFollowUp $dealFollowUp): void
    {
        //deal automation trigger
        if ($dealFollowUp->deal) {
            $this->dealAutomation->process($dealFollowUp->deal, 'followup_created');

            Log::info('[DealFollowUpObserver::created] About to call recordFollowUpCreated.', [
                'deal_id' => $dealFollowUp->deal->id,
                'followup_id' => $dealFollowUp->id,
            ]);

            $this->dealActivityEventService->recordFollowUpCreated($dealFollowUp->deal, $dealFollowUp);

            Log::info('[DealFollowUpObserver::created] recordFollowUpCreated completed.');
        } else {
            Log::warning('[DealFollowUpObserver::created] No deal relation found — skipping CRM event.', [
                'deal_id' => $dealFollowUp->deal_id,
            ]);
        }

        if (isSeedingData()) {
            return;
        }

        if (!FeatureFlags::enabled('integrations.zoho-calendar-sync')) {
            return;
        }

        $creatorUserId = $dealFollowUp->added_by;
        if (!$creatorUserId) {
            return;
        }

        $hasLinkedZohoProfile = EmployeeDetails::query()
            ->where('user_id', $creatorUserId)
            ->whereNotNull('zoho_id')
            ->exists();

        if (!$hasLinkedZohoProfile) {
            return;
        }

        // Show the user an immediate "pending" indicator, while the queued job
        // performs the OL enqueue request and stores the returned jobId.
        $dealFollowUp->update([
            'zoho_calendar_job_id' => $dealFollowUp->zoho_calendar_job_id,
            'zoho_calendar_sync_status' => DealFollowUp::ZOHO_CALENDAR_SYNC_PENDING,
        ]);

        SyncZohoCalendarEventJob::dispatch($dealFollowUp->id);
    }

    /**
     * Handle the DealFollowUp "updated" event.
     */
    public function updated(DealFollowUp $dealFollowUp): void
    {
        // Send notification for meeting/follow-up updated
        if (!isRunningInConsoleOrSeeding() && user()) {
            $deal = Deal::find($dealFollowUp->deal_id);
            if ($deal) {
                $meetingDate = $dealFollowUp->next_follow_up_date 
                    ? $dealFollowUp->next_follow_up_date->format('M d, Y H:i') 
                    : null;
                
                $this->notificationService->notifyMeetingUpdated(
                    $deal,
                    $dealFollowUp->remark ?? 'Follow-up updated',
                    $meetingDate,
                    $dealFollowUp->id
                );
            }
        }
    }

    /**
     * Handle the DealFollowUp "deleted" event.
     */
    public function deleted(DealFollowUp $dealFollowUp): void
    {
        //
    }

    /**
     * Handle the DealFollowUp "restored" event.
     */
    public function restored(DealFollowUp $dealFollowUp): void
    {
        //
    }

    /**
     * Handle the DealFollowUp "force deleted" event.
     */
    public function forceDeleted(DealFollowUp $dealFollowUp): void
    {
        //
    }
}
