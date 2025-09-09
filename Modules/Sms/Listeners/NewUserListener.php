<?php

namespace Modules\Sms\Listeners;

use App\Events\NewUserEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewUser;

class NewUserListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(NewUserEvent $event)
    {
        try {
            Notification::send($event->user, new NewUser($event->user, $event->password));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
