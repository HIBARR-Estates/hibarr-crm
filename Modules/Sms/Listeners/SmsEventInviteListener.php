<?php

namespace Modules\Sms\Listeners;

use App\Events\EventInviteEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\EventInviteSms;

class SmsEventInviteListener
{
    /**
     * Handle the event.
     *
     * @param  object  $event
     * @return void
     */
    public function handle(EventInviteEvent $event)
    {
        try {
            Notification::send($event->notifyUser, new EventInviteSms($event->event));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
