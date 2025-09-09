<?php

namespace Modules\Sms\Listeners;

use App\Events\NewProductPurchaseEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewProductPurchaseRequest;

class NewProductPurchaseListener
{
    public function handle(NewProductPurchaseEvent $event)
    {
        try {
            Notification::send(User::allAdmins($event->invoice->company->id), new NewProductPurchaseRequest($event->invoice));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
