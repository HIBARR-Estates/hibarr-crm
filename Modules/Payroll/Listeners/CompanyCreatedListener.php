<?php

namespace Modules\Payroll\Listeners;

use Modules\Payroll\Entities\PayrollSetting;

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
        PayrollSetting::addModuleSetting($company);
    }
}
