<?php

namespace App\Listeners;

use App\Events\AutoTaskReminderEvent;
use App\Notifications\AutoTaskReminder;
use App\Services\TaskVisibilityService;
use Illuminate\Support\Facades\Notification;

class AutoTaskReminderListener
{

    /**
     * Handle the event.
     *
     * @param AutoTaskReminderEvent $event
     * @return void
     */

    public function handle(AutoTaskReminderEvent $event)
    {
        $recipients = TaskVisibilityService::reminderRecipients($event->task);
        Notification::send($recipients, new AutoTaskReminder($event->task));
    }

}
