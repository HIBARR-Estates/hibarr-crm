<?php

namespace Modules\QRCode\Listeners;

use Modules\QRCode\Entities\QRCodeSetting;

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
        QRCodeSetting::addModuleSetting($company);
    }
}
