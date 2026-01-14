<?php

namespace App\Observers;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;

class DealFollowUpObserver
{
    protected DealAutomationService $dealAutomation;
    protected DealNotificationService $notificationService;

    public function __construct(
        DealAutomationService $dealAutomation,
        DealNotificationService $notificationService
    ) {
        $this->dealAutomation = $dealAutomation;
        $this->notificationService = $notificationService;
    }

    /**
     * Handle the DealFollowUp "created" event.
     */
    public function created(DealFollowUp $dealFollowUp): void
    {
        // Deal automation trigger
        $this->dealAutomation->automate($dealFollowUp->lead);

        // Send notification for meeting/follow-up scheduled
        if (!isRunningInConsoleOrSeeding() && user()) {
            $deal = Deal::find($dealFollowUp->deal_id);
            if ($deal) {
                $meetingDate = $dealFollowUp->next_follow_up_date 
                    ? $dealFollowUp->next_follow_up_date->format('M d, Y H:i') 
                    : null;
                
                $this->notificationService->notifyMeetingScheduled(
                    $deal,
                    $dealFollowUp->remark ?? 'Follow-up scheduled',
                    $meetingDate,
                    $dealFollowUp->id
                );
            }
        }
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
