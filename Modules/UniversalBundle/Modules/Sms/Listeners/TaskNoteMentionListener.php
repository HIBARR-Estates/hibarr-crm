<?php

namespace Modules\Sms\Listeners;

use App\Events\TaskNoteMentionEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\TaskNoteMention;

class TaskNoteMentionListener
{
    public function handle(TaskNoteMentionEvent $event)
    {
        try {
            if (isset($event->mentionuser)) {
                $mentionUserId = $event->mentionuser;
                $mentionUser = User::whereIn('id', ($mentionUserId))->get();
                Notification::send($mentionUser, new TaskNoteMention($event->task, $event));


            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
