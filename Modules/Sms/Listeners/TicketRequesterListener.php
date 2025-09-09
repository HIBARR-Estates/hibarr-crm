<?php

namespace Modules\Sms\Listeners;

use App\Events\TicketRequesterEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewTicketRequester;

class TicketRequesterListener
{
    public function handle(TicketRequesterEvent $event)
    {
        try {
            if (! is_null($event->notifyUser)) {
                Notification::send($event->notifyUser, new NewTicketRequester($event->ticket));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
