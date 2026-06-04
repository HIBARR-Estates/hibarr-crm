<?php

namespace App\Listeners;

use App\Events\TaskReminderEvent;
use App\Notifications\TaskReminder;
use App\Services\TaskVisibilityService;
use Illuminate\Support\Facades\Notification;

class TaskReminderListener
{

    /**
     * Handle the event.
     *
     * @param TaskReminderEvent $event
     * @return void
     */

    public function handle(TaskReminderEvent $event)
    {
        $recipients = TaskVisibilityService::reminderRecipients($event->task);
        Notification::send($recipients, new TaskReminder($event->task));
    }

}
