<?php

namespace App\Listeners;

use App\Events\TaskEvent;
use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\NewTask;
use App\Notifications\TaskUpdated;
use App\Notifications\NewClientTask;
use App\Notifications\TaskCompleted;
use App\Notifications\TaskApproval;
use App\Notifications\TaskStatusUpdated;
use App\Notifications\TaskUpdatedClient;
use App\Notifications\TaskCompletedClient;
use App\Notifications\TaskMention;
use Illuminate\Support\Facades\Notification;

class TaskListener
{

    /**
     * Handle the event.
     *
     * @param TaskEvent $event
     * @return void
     */

    public function handle(TaskEvent $event)
    {
        $suppressBulkTransactionalEmails = app()->bound('suppress_bulk_notifications')
            && app('suppress_bulk_notifications') === true;

        if ($event->notificationName) {
            $prepareNotification = function ($notification) use ($suppressBulkTransactionalEmails) {
                if ($suppressBulkTransactionalEmails && $notification instanceof BaseNotification) {
                    $notification->setSuppressBulkTransactionalEmails(true);
                }
                return $notification;
            };

            if ($event->notificationName == 'NewClientTask') {
                Notification::send($event->notifyUser, $prepareNotification(new NewClientTask($event->task)));
            }
            elseif ($event->notificationName == 'NewTask') {
                Notification::send($event->notifyUser, $prepareNotification(new NewTask($event->task)));
            }
            elseif ($event->notificationName == 'TaskUpdated') {
                Notification::send($event->notifyUser, $prepareNotification(new TaskUpdated($event->task)));
            }
            elseif ($event->notificationName == 'TaskStatusUpdated') {
                Notification::send($event->notifyUser, $prepareNotification(new TaskStatusUpdated($event->task, user())));
            }
            elseif ($event->notificationName == 'TaskApproval') {
                Notification::send($event->notifyUser, $prepareNotification(new TaskApproval($event->task, user())));
            }
            elseif ($event->notificationName == 'TaskCompleted') {
                Notification::send($event->notifyUser, $prepareNotification(new TaskCompleted($event->task, user())));
            }
            elseif ($event->notificationName == 'TaskCompletedClient') {
                Notification::send($event->notifyUser, $prepareNotification(new TaskCompletedClient($event->task)));
            }
            elseif ($event->notificationName == 'TaskUpdatedClient') {
                Notification::send($event->notifyUser, $prepareNotification(new TaskUpdatedClient($event->task)));
            }
            elseif ($event->notificationName == 'TaskMention') {
                Notification::send($event->notifyUser, $prepareNotification(new TaskMention($event->task)));
            }
        }
    }

}
