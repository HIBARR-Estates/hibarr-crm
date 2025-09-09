<?php

namespace Modules\Sms\Listeners;

use App\Events\TaskEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewClientTaskSms;
use Modules\Sms\Notifications\NewTaskSms;
use Modules\Sms\Notifications\TaskCompletedClient;
use Modules\Sms\Notifications\TaskCompletedSms;
use Modules\Sms\Notifications\TaskStatusUpdatedSms;
use Modules\Sms\Notifications\TaskUpdatedClientSms;
use Modules\Sms\Notifications\TaskUpdatedSms;
use Modules\Sms\Notifications\TaskMentionSms;

class SmsTaskListener
{
    /**
     * Handle the event.
     *
     * @param  object  $event
     * @return void
     */
    public function handle(TaskEvent $event)
    {
        try {
            if ($event->notificationName == 'NewClientTask') {
                Notification::send($event->notifyUser, new NewClientTaskSms($event->task));
            }
            elseif ($event->notificationName == 'NewTask') {
                Notification::send($event->notifyUser, new NewTaskSms($event->task));
            }
            elseif ($event->notificationName == 'TaskUpdated') {
                Notification::send($event->notifyUser, new TaskUpdatedSms($event->task));
            }
            elseif ($event->notificationName == 'TaskCompleted') {
                Notification::send($event->notifyUser, new TaskCompletedSms($event->task));
            }
            elseif ($event->notificationName == 'TaskStatusUpdated') {
                Notification::send($event->notifyUser, new TaskStatusUpdatedSms($event->task));
            }
            elseif ($event->notificationName == 'TaskCompletedClient') {
                Notification::send($event->notifyUser, new TaskCompletedClient($event->task));
            }
            elseif ($event->notificationName == 'TaskUpdatedClient') {
                Notification::send($event->notifyUser, new TaskUpdatedClientSms($event->task));
            }
            elseif ($event->notificationName == 'TaskMentionSms') {
                Notification::send($event->notifyUser, new TaskMentionSms($event->task));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
