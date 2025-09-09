<?php

namespace Modules\Sms\Listeners;

use App\Events\EstimateDeclinedEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\EstimateDeclined;

class EstimateDeclinedListener
{

    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(EstimateDeclinedEvent $event)
    {
        try {
            $company = $event->estimate->company;
            Notification::send(User::allAdmins($company->id), new EstimateDeclined($event->estimate));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
