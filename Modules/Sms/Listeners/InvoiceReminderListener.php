<?php

namespace Modules\Sms\Listeners;

use App\Events\InvoiceReminderEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\InvoiceReminder;

class InvoiceReminderListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(InvoiceReminderEvent $event)
    {
        try {
            Notification::send($event->notifyUser, new InvoiceReminder($event->invoice));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
