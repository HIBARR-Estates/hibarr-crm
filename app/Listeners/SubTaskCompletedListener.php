<?php

namespace App\Listeners;

use App\Events\SubTaskCompletedEvent;
use App\Notifications\SubTaskAssigneeAdded;
use App\Notifications\SubTaskCompleted;
use App\Notifications\SubTaskCreated;
use Illuminate\Support\Facades\Notification;

class SubTaskCompletedListener
{

    /**
     * Handle the event.
     *
     * @param SubTaskCompletedEvent $event
     * @return void
     */

    public function handle(SubTaskCompletedEvent $event)
    {
        // Set by SubTaskController for checklist-item requests (see
        // withSubTaskNotificationsSuppressedIfChecklist) — a checklist tick
        // isn't an assignment or milestone worth notifying anyone about,
        // unlike a real sub-task. Unlike suppressBulkTransactionalEmails
        // elsewhere in the app, this skips the database (in-app) channel
        // too, since the ask here is no notification at all, not just no email.
        if (app()->bound('suppress_subtask_notifications') && app('suppress_subtask_notifications') === true) {
            return;
        }

        if ($event->status == 'completed') {
            Notification::send($event->subTask->task->users, new SubTaskCompleted($event->subTask));
        }

        elseif ($event->status == 'created') {
            Notification::send($event->subTask->task->users, new SubTaskCreated($event->subTask));
        }

        if ($event->subTask->assigned_to && $event->subTask->isDirty('assigned_to')) {
            Notification::send($event->subTask->assignedTo, new SubTaskAssigneeAdded($event->subTask));
        }

    }

}
