<?php

namespace Modules\Sms\Listeners;

use App\Events\OrderUpdatedEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\OrderUpdated;

class OrderUpdatedListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(OrderUpdatedEvent $event)
    {
        try {
            $company = $event->order->company;
            Notification::send($event->notifyUser, new OrderUpdated($event->order));

            Notification::send(User::allAdmins($company->id), new OrderUpdated($event->order));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
