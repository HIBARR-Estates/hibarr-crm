<?php

namespace Modules\Sms\Listeners;

use App\Events\RemovalRequestApprovedRejectUserEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\RemovalRequestApprovedUser;
use Modules\Sms\Notifications\RemovalRequestRejectUser;

class RemovalRequestApprovedRejectUserListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(RemovalRequestApprovedRejectUserEvent $event)
    {
        try {
            if ($event->removal->status == 'approved') {
                Notification::send($event->removal->user, new RemovalRequestApprovedUser($event->removal->user));
            }
            else {
                Notification::send($event->removal->user, new RemovalRequestRejectUser($event->removal->user));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
