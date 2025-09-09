<?php

namespace Modules\Sms\Listeners;

use App\Events\AutoTaskReminderEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\AutoTaskReminder;

class AutoTaskReminderListener
{

    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(AutoTaskReminderEvent $event)
    {
        try {
            Notification::send($event->task->users, new AutoTaskReminder($event->task));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
