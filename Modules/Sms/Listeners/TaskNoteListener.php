<?php

namespace Modules\Sms\Listeners;

use App\Events\TaskNoteEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\TaskNote;
use Modules\Sms\Notifications\TaskNoteClient;

class TaskNoteListener
{
    public function handle(TaskNoteEvent $event)
    {
        try {
            if ($event->client == 'client') {
                Notification::send($event->notifyUser, new TaskNoteClient($event->task, $event->created_at));
            }
            else {
                Notification::send($event->notifyUser, new TaskNote($event->task, $event->created_at));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
