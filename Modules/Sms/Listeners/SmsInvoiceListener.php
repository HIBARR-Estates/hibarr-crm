<?php

namespace Modules\Sms\Listeners;

use App\Events\NewInvoiceEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewInvoiceSms;

class SmsInvoiceListener
{
    /**
     * Handle the event.
     *
     * @param  object  $event
     * @return void
     */
    public function handle(NewInvoiceEvent $event)
    {
        try {
            Notification::send($event->notifyUser, new NewInvoiceSms($event->invoice));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
