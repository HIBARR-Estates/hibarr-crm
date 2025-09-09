<?php

namespace Modules\Sms\Listeners;

use Modules\Sms\Entities\SmsSetting;

class CompanyCreatedListener
{
    /**
     * Handle the event.
     *
     * @param  object  $event
     * @return void
     */
    public function handle($event)
    {
        $company = $event->company;
        SmsSetting::addModuleSetting($company);
    }
}
