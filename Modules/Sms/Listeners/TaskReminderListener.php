<?php

namespace Modules\Sms\Listeners;

use App\Events\TaskReminderEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\TaskReminder;

class TaskReminderListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(TaskReminderEvent $event)
    {
        try {
            Notification::send($event->task->activeUsers, new TaskReminder($event->task));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
