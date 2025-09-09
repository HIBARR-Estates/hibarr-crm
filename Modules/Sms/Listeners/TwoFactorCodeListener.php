<?php

namespace Modules\Sms\Listeners;

use App\Events\TwoFactorCodeEvent;
use Modules\Sms\Notifications\TwoFactorCode;

class TwoFactorCodeListener
{

    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(TwoFactorCodeEvent $event)
    {
        try {
            $event->user->notify(new TwoFactorCode);
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
