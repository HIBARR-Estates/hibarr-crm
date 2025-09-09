<?php

namespace Modules\Sms\Listeners;

use App\Events\SubTaskCompletedEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\SubTaskAssigneeAdded;
use Modules\Sms\Notifications\SubTaskCompleted;

class SubTaskCompletedListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(SubTaskCompletedEvent $event)
    {
        try {
            if ($event->status == 'completed') {
                Notification::send($event->subTask->task->users, new SubTaskCompleted($event->subTask));
            }

            if ($event->subTask->assigned_to && $event->subTask->isDirty('assigned_to')) {
                Notification::send($event->subTask->assignedTo, new SubTaskAssigneeAdded($event->subTask));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
