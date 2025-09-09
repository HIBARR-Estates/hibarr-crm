<?php

namespace Modules\Sms\Listeners;

use App\Events\NewPaymentEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewPayment;

class NewPaymentListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(NewPaymentEvent $event)
    {
        try {
            Notification::send($event->notifyUsers, new NewPayment($event->payment));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
