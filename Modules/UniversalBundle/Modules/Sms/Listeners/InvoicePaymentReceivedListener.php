<?php

namespace Modules\Sms\Listeners;

use App\Events\InvoicePaymentReceivedEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\InvoicePaymentReceived;

class InvoicePaymentReceivedListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(InvoicePaymentReceivedEvent $event)
    {
        try {
            Notification::send(User::allAdmins($event->payment->company->id), new InvoicePaymentReceived($event->payment));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
