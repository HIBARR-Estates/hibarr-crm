<?php

namespace App\Observers;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Jobs\DeleteCalendarSyncEventJob;
use App\Services\DealActivityEventService;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\Log;

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

        // Calendar sync is scheduled after meeting automation completes so the
        // OL payload includes meeting_link and lead/contact guest details.
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
                $meetingDateUtc = $dealFollowUp->next_follow_up_date
                    ? $dealFollowUp->next_follow_up_date->copy()->utc()->toIso8601String()
                    : null;

                $this->notificationService->notifyMeetingUpdated(
                    $deal,
                    $dealFollowUp->remark ?? 'Follow-up updated',
                    $meetingDateUtc,
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
        if (!FeatureFlags::enabled('integrations.zoho-calendar-sync')) {
            return;
        }

        $eventUid = $dealFollowUp->zoho_calendar_event_uid;
        $creatorUserId = $dealFollowUp->added_by;

        if (!$eventUid || !$creatorUserId) {
            return;
        }

        DeleteCalendarSyncEventJob::dispatch(
            (string) $eventUid,
            (int) $creatorUserId,
            $dealFollowUp->id
        );
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
