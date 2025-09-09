<?php

namespace Modules\Sms\Listeners;

use App\Events\AutoFollowUpReminderEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\AutoFollowUpReminder;

class AutoFollowUpReminderListener
{

    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(AutoFollowUpReminderEvent $event)
    {
        $notifyUser = ($event->followup->lead && $event->followup->lead->leadAgent && $event->followup->lead->leadAgent->user) ? $event->followup->lead->leadAgent->user : ($event->followup->lead->added_by ? $event->followup->lead->addedBy() : $event->followup->addedBy());

        try {
            if ($notifyUser) {
                Notification::send($notifyUser, new AutoFollowUpReminder($event->followup));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
