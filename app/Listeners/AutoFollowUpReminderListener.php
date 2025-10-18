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
        // Check if the deal relationship exists and has company_id
        if (!$event->followup->deal || !$event->followup->deal->company_id) {
            return; // Skip if no deal or company_id
        }

        $companyId = $event->followup->deal->company_id;

        $adminUserIds = User::allAdmins($companyId)->pluck('id')->toArray();

        /** @phpstan-ignore-next-line */
        $notifyUser = (is_null($event->followup->deal->leadAgent)) ? User::whereIn('id', $adminUserIds)->get() : $event->followup->deal->leadAgent->user;

        if ($notifyUser) {
            Notification::send($notifyUser, new AutoFollowUpReminder($event->followup,$event->subject));
        }

    }

}
