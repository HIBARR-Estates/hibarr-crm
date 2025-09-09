<?php

namespace Modules\Sms\Listeners;

use App\Events\EventReminderEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\EventReminder;

class EventReminderListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(EventReminderEvent $event)
    {
        try {
            Notification::send($event->event->getUsers(), new EventReminder($event->event));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
