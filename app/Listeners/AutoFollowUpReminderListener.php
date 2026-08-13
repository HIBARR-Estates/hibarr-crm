<?php

namespace App\Listeners;

use App\Events\AutoFollowUpReminderEvent;
use App\Models\User;
use App\Notifications\AutoFollowUpReminder;
use Illuminate\Support\Facades\Notification;

class AutoFollowUpReminderListener
{
    /**
     * Handle the event.
     *
     * @param AutoFollowUpReminderEvent $event
     * @return void
     */
    public function handle(AutoFollowUpReminderEvent $event)
    {
        $followup = $event->followup->loadMissing([
            'addedBy',
            'deal.leadAgent.user',
            'deal.contact',
            'lead.leadOwner',
            'meetingType',
        ]);

        $isMeetingCreatedNotice = (bool) $event->subject;
        $creatorUserId = $followup->added_by ? (int) $followup->added_by : null;

        // If a specific target user is specified, send only to them (unless they
        // just created the follow-up).
        if ($event->targetUserId) {
            $targetUserId = (int) $event->targetUserId;
            if (!$isMeetingCreatedNotice || $targetUserId !== $creatorUserId) {
                $targetUser = User::find($targetUserId);
                if ($targetUser) {
                    Notification::send($targetUser, new AutoFollowUpReminder($followup, $event->subject));
                }
            }
            $this->notifyLead($followup, $event->subject);
            return;
        }

        // The "meeting created" email (subject === true) never goes to whoever
        // just created the follow-up — even when ensureCreatorIsParticipant
        // added them to the participants list.
        $excludeUserId = $isMeetingCreatedNotice ? $creatorUserId : null;

        $participantIds = collect($followup->participants ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0);

        if ($excludeUserId) {
            $participantIds = $participantIds->reject(fn (int $id) => $id === $excludeUserId);
        }

        // Deal-linked: agent and meeting participants. When no agent is
        // assigned, fall back to company admins (legacy behaviour).
        if ($followup->deal && $followup->deal->company_id) {
            $companyId = $followup->deal->company_id;
            $stakeholderIds = collect();

            if ($followup->deal->leadAgent?->user_id) {
                $agentUserId = (int) $followup->deal->leadAgent->user_id;
                $agentIsCreator = $excludeUserId && $agentUserId === $excludeUserId;
                $agentIsParticipant = $participantIds->contains($agentUserId);

                // Agent gets the email as a participant when listed there; only
                // add separately when they are neither the creator nor already
                // a participant.
                if (!$agentIsCreator && !$agentIsParticipant) {
                    $stakeholderIds->push($agentUserId);
                }
            } elseif (is_null($followup->deal->leadAgent)) {
                $stakeholderIds = collect(User::allAdmins($companyId)->pluck('id'));
            }

            $ids = $stakeholderIds
                ->merge($participantIds)
                ->filter()
                ->unique()
                ->values();

            if ($excludeUserId) {
                $ids = $ids->reject(fn ($id) => (int) $id === $excludeUserId);
            }

            if ($ids->isNotEmpty()) {
                $users = User::whereIn('id', $ids)->get();
                if ($users->isNotEmpty()) {
                    Notification::send($users, new AutoFollowUpReminder($followup, $event->subject));
                }
            }

            $this->notifyLead($followup, $event->subject);
            return;
        }

        // Lead-only meeting: lead owner + participants. Creator is included only
        // for periodic reminders, not the "just created" notice.
        if ($followup->lead) {
            $ids = collect([$followup->lead->lead_owner])
                ->when(! $isMeetingCreatedNotice, fn ($c) => $c->push($followup->added_by))
                ->merge($participantIds)
                ->filter()
                ->unique()
                ->values();

            if ($excludeUserId) {
                $ids = $ids->reject(fn ($id) => (int) $id === $excludeUserId);
            }

            if ($ids->isNotEmpty()) {
                $users = User::whereIn('id', $ids)->get();
                if ($users->isNotEmpty()) {
                    Notification::send($users, new AutoFollowUpReminder($followup, $event->subject));
                }
            }

            $this->notifyLead($followup, $event->subject);
        }
    }

    /**
     * The lead/contact a meeting was scheduled for gets their own customer-facing
     * copy of the same notification — separate from internal participants/agents.
     */
    private function notifyLead($followup, $subject): void
    {
        $lead = $followup->lead ?? $followup->deal?->contact;
        if (! $lead) {
            return;
        }

        $leadEmail = $lead->client_email ?? null;
        if (! is_string($leadEmail) || trim($leadEmail) === '') {
            return;
        }

        Notification::send($lead, new AutoFollowUpReminder($followup, $subject));
    }
}
