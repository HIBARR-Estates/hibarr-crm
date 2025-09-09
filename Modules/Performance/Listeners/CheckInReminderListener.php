<?php

namespace Modules\Performance\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\Performance\Events\CheckInReminderEvent;
use Modules\Performance\Notifications\CheckInReminderNotification;

class CheckInReminderListener
{

    /**
     * Handle the meeting.
     *
     * @param CheckInReminderEvent $reminder
     * @return void
     */
    public function handle(CheckInReminderEvent $reminder)
    {
        if ($reminder->owners) {
            $keyResult = $reminder->keyResult ?? null;

            foreach ($reminder->owners as $owner) {
                if ($owner->user) {
                    $owner->user->notify(new CheckInReminderNotification($reminder->objective, $keyResult));
                }
            }
        }
    }

}
