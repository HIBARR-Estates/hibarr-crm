<?php

namespace Modules\Sms\Listeners;

use App\Events\ProjectReminderEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\ProjectReminder;

class ProjectReminderListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(ProjectReminderEvent $event)
    {
        try {
            Notification::send($event->user, new ProjectReminder($event->projects, $event->user, $event->data));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
