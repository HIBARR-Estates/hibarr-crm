<?php

namespace Modules\Sms\Listeners;

use App\Events\RemovalRequestApprovedRejectLeadEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\RemovalRequestApprovedLead;
use Modules\Sms\Notifications\RemovalRequestRejectLead;

class RemovalRequestApprovedRejectLeadListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(RemovalRequestApprovedRejectLeadEvent $event)
    {
        try {
            if ($event->removal->status == 'approved') {
                Notification::send($event->removal->lead, new RemovalRequestApprovedLead($event->removal->lead));
            }
            else {
                Notification::send($event->removal->lead, new RemovalRequestRejectLead($event->removal->lead));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
