<?php

namespace Modules\Sms\Listeners;

use App\Events\PaymentReminderEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\PaymentReminder;

class PaymentReminderListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(PaymentReminderEvent $event)
    {
        try {
            Notification::send($event->notifyUser, new PaymentReminder($event->invoice));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
