<?php

namespace App\Observers;

use App\Enums\DealActivityType;
use App\Jobs\DeleteCalendarSyncEventJob;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\DealFollowUp;
use App\Services\DealActivityEventService;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;
use App\Services\Reminders\MeetingReminderSync;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\Log;

class DealFollowUpObserver
{
    protected DealAutomationService $dealAutomation;

    protected DealNotificationService $notificationService;

    protected DealActivityEventService $dealActivityEventService;

    protected MeetingReminderSync $meetingReminderSync;

    public function __construct(
        DealAutomationService $dealAutomation,
        DealNotificationService $notificationService,
        DealActivityEventService $dealActivityEventService,
        MeetingReminderSync $meetingReminderSync,
    ) {
        $this->dealAutomation = $dealAutomation;
        $this->notificationService = $notificationService;
        $this->dealActivityEventService = $dealActivityEventService;
        $this->meetingReminderSync = $meetingReminderSync;
    }

    /**
     * Handle the DealFollowUp "created" event.
     */
    public function created(DealFollowUp $dealFollowUp): void
    {
        if (! isRunningInConsoleOrSeeding() && ! isSeedingData()) {
            if ($dealFollowUp->deal) {
                $this->dealAutomation->process($dealFollowUp->deal, 'followup_created');

                Log::info('[DealFollowUpObserver::created] About to call recordFollowUpCreated.', [
                    'deal_id' => $dealFollowUp->deal->id,
                    'followup_id' => $dealFollowUp->id,
                ]);

                $this->dealActivityEventService->recordFollowUpCreated($dealFollowUp->deal, $dealFollowUp);

                Log::info('[DealFollowUpObserver::created] recordFollowUpCreated completed.');
            } elseif ($dealFollowUp->lead_id && $dealFollowUp->lead) {
                // Lead follow-up (no deal attached) — same trigger idea as the deal
                // side, fired through the lead-subject automation flow.
                $this->dealAutomation->processLead($dealFollowUp->lead, DealAutomation::TRIGGER_LEAD_FOLLOWUP_CREATED);
            } else {
                Log::warning('[DealFollowUpObserver::created] No deal or lead relation found — skipping CRM event.', [
                    'deal_id' => $dealFollowUp->deal_id,
                    'lead_id' => $dealFollowUp->lead_id,
                ]);
            }
        }

        if (isSeedingData()) {
            return;
        }

        $this->notifyMeetingActivity($dealFollowUp, DealActivityType::MEETING_SCHEDULED);

        // Calendar sync is scheduled after meeting automation completes so the
        // OL payload includes meeting_link and lead/contact guest details.
    }

    /**
     * Handle the DealFollowUp "updated" event.
     */
    public function updated(DealFollowUp $dealFollowUp): void
    {
        if ($this->shouldSkipMeetingNotification($dealFollowUp)) {
            return;
        }

        if ($dealFollowUp->wasChanged('status') && $dealFollowUp->status === 'cancelled') {
            $this->meetingReminderSync->cancelForFollowUp($dealFollowUp);
            $this->notifyMeetingActivity($dealFollowUp, DealActivityType::MEETING_CANCELLED);

            return;
        }

        if ($this->isIncidentalMeetingUpdate($dealFollowUp)) {
            return;
        }

        $this->notifyMeetingActivity($dealFollowUp, DealActivityType::MEETING_UPDATED);
    }

    /**
     * Handle the DealFollowUp "deleted" event.
     */
    public function deleted(DealFollowUp $dealFollowUp): void
    {
        if (! $this->shouldSkipMeetingNotification($dealFollowUp) && $dealFollowUp->status !== 'cancelled') {
            $this->notifyMeetingActivity($dealFollowUp, DealActivityType::MEETING_CANCELLED);
        }

        if (! FeatureFlags::enabled('integrations.zoho-calendar-sync')) {
            return;
        }

        $eventUid = $dealFollowUp->zoho_calendar_event_uid;
        $creatorUserId = $dealFollowUp->added_by;

        if (! $eventUid || ! $creatorUserId) {
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

    private function shouldSkipMeetingNotification(DealFollowUp $dealFollowUp): bool
    {
        return isRunningInConsoleOrSeeding() || isSeedingData();
    }

    /**
     * Automation webhooks and calendar sync often patch link/metadata fields
     * immediately after create — those should not look like a user edit.
     */
    private function isIncidentalMeetingUpdate(DealFollowUp $dealFollowUp): bool
    {
        $incidentalFields = [
            'meeting_link',
            'meeting_id',
            'event_id',
            'zoho_calendar_event_uid',
            'zoho_calendar_sync_status',
            'last_updated_by',
            'updated_at',
        ];

        $meaningfulChanges = array_diff(
            array_keys($dealFollowUp->getChanges()),
            $incidentalFields
        );

        return $meaningfulChanges === [];
    }

    private function notifyMeetingActivity(DealFollowUp $dealFollowUp, DealActivityType $activityType): void
    {
        $deal = $this->resolveDealForFollowUp($dealFollowUp);
        if (! $deal) {
            return;
        }

        $meetingDateUtc = $dealFollowUp->next_follow_up_date
            ? $dealFollowUp->next_follow_up_date->copy()->utc()->toIso8601String()
            : null;

        $remark = $dealFollowUp->remark ?? match ($activityType) {
            DealActivityType::MEETING_SCHEDULED => 'Meeting scheduled',
            DealActivityType::MEETING_CANCELLED => 'Meeting cancelled',
            default => 'Follow-up updated',
        };

        $excludeUserId = user()?->id ?? ($dealFollowUp->added_by ? (int) $dealFollowUp->added_by : null);

        match ($activityType) {
            DealActivityType::MEETING_SCHEDULED => $this->notificationService->notifyMeetingScheduled(
                $deal,
                $remark,
                $meetingDateUtc,
                $dealFollowUp->id,
                $excludeUserId,
            ),
            DealActivityType::MEETING_CANCELLED => $this->notificationService->notifyMeetingCancelled(
                $deal,
                $remark,
                $meetingDateUtc,
                $dealFollowUp->id,
                $excludeUserId,
            ),
            DealActivityType::MEETING_UPDATED => $this->notificationService->notifyMeetingUpdated(
                $deal,
                $remark,
                $meetingDateUtc,
                $dealFollowUp->id,
                $excludeUserId,
            ),
            default => null,
        };
    }

    private function resolveDealForFollowUp(DealFollowUp $dealFollowUp): ?Deal
    {
        if (! $dealFollowUp->deal_id) {
            return null;
        }

        if ($dealFollowUp->relationLoaded('deal') && $dealFollowUp->deal) {
            return $dealFollowUp->deal;
        }

        return Deal::find($dealFollowUp->deal_id);
    }
}
