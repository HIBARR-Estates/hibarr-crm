<?php

namespace Modules\Biolinks\Listeners;

use Modules\Biolinks\Entities\BiolinksGlobalSetting;

class CompanyCreatedListener
{

    /**
     * Handle the event.
     *
     * @param object $event
     * @return void
     */
    public function handle($event)
    {
        $company = $event->company;
        BiolinksGlobalSetting::addModuleSetting($company);
    }

}
