<?php

namespace Modules\Sms\Listeners;

use App\Events\TaskCommentEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\TaskComment;
use Modules\Sms\Notifications\TaskCommentClient;

class TaskCommentListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(TaskCommentEvent $event)
    {
        try {
            if ($event->client == 'client') {
                Notification::send($event->notifyUser, new TaskCommentClient($event->task, $event->comment));
            }
            else {
                Notification::send($event->notifyUser, new TaskComment($event->task, $event->comment));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
