<?php

namespace Modules\RestAPI\Listeners;

use Modules\RestAPI\Entities\RestAPISetting;

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
        RestAPISetting::addModuleSetting($company);
    }
}
