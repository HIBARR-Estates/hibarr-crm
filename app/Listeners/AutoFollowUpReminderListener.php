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
            'deal.leadAgent.user',
            'deal.contact',
            'lead.leadOwner',
            'meetingType',
        ]);

        // If a specific target user is specified, send only to them
        if ($event->targetUserId) {
            $targetUser = User::find($event->targetUserId);
            if ($targetUser) {
                Notification::send($targetUser, new AutoFollowUpReminder($followup, $event->subject));
            }
            return;
        }

        // The "meeting created" notice (subject === true) never goes to whoever just
        // created it — they already know. Periodic legacy reminders (subject === false)
        // are unaffected.
        $excludeUserId = $event->subject && $followup->added_by ? (int) $followup->added_by : null;

        // Deal-linked: agent or company admins
        if ($followup->deal && $followup->deal->company_id) {
            $companyId = $followup->deal->company_id;
            $adminUserIds = User::allAdmins($companyId)->pluck('id')->toArray();
            /** @phpstan-ignore-next-line */
            $notifyUser = is_null($followup->deal->leadAgent)
                ? User::whereIn('id', $adminUserIds)->get()
                : $followup->deal->leadAgent->user;

            if ($excludeUserId && $notifyUser instanceof \Illuminate\Support\Collection) {
                $notifyUser = $notifyUser->reject(fn ($user) => (int) $user->id === $excludeUserId);
            } elseif ($excludeUserId && $notifyUser && (int) $notifyUser->id === $excludeUserId) {
                $notifyUser = null;
            }

            $hasRecipients = $notifyUser instanceof \Illuminate\Support\Collection
                ? $notifyUser->isNotEmpty()
                : (bool) $notifyUser;

            if ($hasRecipients) {
                Notification::send($notifyUser, new AutoFollowUpReminder($followup, $event->subject));
            }
            return;
        }

        // Lead-only meeting: notify lead owner (+ creator, unless this is the
        // "just created" notice, which excludes them).
        if ($followup->lead) {
            $ids = collect([
                $followup->lead->lead_owner,
                $followup->added_by,
            ])->filter()->unique()->values();

            if ($excludeUserId) {
                $ids = $ids->reject(fn ($id) => (int) $id === $excludeUserId);
            }

            if ($ids->isEmpty()) {
                return;
            }

            $users = User::whereIn('id', $ids)->get();
            if ($users->isNotEmpty()) {
                Notification::send($users, new AutoFollowUpReminder($followup, $event->subject));
            }
        }
    }
}
