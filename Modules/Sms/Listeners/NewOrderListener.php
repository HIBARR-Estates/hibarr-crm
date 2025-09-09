<?php

namespace Modules\Sms\Listeners;

use App\Events\NewOrderEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewOrder;

class NewOrderListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(NewOrderEvent $event)
    {
        try {
            $company = $event->order->company;
            Notification::send($event->notifyUser, new NewOrder($event->order));
            Notification::send(User::allAdmins($company->id), new NewOrder($event->order));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
