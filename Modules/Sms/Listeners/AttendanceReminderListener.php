<?php

namespace Modules\Sms\Listeners;

use App\Events\AttendanceReminderEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\AttendanceReminder;

class AttendanceReminderListener
{

    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(AttendanceReminderEvent $event)
    {
        try {
            Notification::send($event->notifyUser, new AttendanceReminder);
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
