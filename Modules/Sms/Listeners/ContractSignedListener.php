<?php

namespace Modules\Sms\Listeners;

use App\Events\ContractSignedEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\ContractSigned;

class ContractSignedListener
{

    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(ContractSignedEvent $event)
    {
        try {
            Notification::send(User::allAdmins($event->contract->company->id), new ContractSigned($event->contract, $event->contractSign));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
