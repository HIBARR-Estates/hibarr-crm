<?php

namespace Modules\Sms\Listeners;

use App\Events\InvoiceUpdatedEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\InvoiceUpdated;

class InvoiceUpdatedListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(InvoiceUpdatedEvent $event)
    {
        try {
            Notification::send($event->notifyUser, new InvoiceUpdated($event->invoice));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
