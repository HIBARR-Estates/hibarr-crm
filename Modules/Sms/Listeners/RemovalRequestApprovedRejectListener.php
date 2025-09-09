<?php

namespace Modules\Sms\Listeners;

use App\Events\RemovalRequestApproveRejectEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\RemovalRequestApproved;
use Modules\Sms\Notifications\RemovalRequestReject;

class RemovalRequestApprovedRejectListener
{
    public function handle(RemovalRequestApproveRejectEvent $event)
    {
        try {
            if ($event->removalRequest->status == 'approved') {
                Notification::send($event->removalRequest->user, new RemovalRequestApproved($event->removalRequest->user));
            }
            else {
                Notification::send($event->removalRequest->user, new RemovalRequestReject($event->removalRequest->user));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }

    }

}
