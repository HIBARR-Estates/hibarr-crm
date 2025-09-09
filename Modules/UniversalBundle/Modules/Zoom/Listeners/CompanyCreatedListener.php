<?php

namespace Modules\Zoom\Listeners;

use Modules\Zoom\Entities\ZoomSetting;

class CompanyCreatedListener
{
    public function handle($event)
    {
        $company = $event->company;
        ZoomSetting::addModuleSetting($company);
    }
}
