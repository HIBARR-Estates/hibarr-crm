<?php

namespace Modules\Webhooks\Listeners;

use Modules\Webhooks\Entities\WebhooksGlobalSetting;

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
        WebhooksGlobalSetting::addModuleSetting($company);
    }

}
