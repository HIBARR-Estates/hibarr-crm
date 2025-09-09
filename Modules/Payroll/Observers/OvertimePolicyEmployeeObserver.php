<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\OvertimePolicyEmployee;

class OvertimePolicyEmployeeObserver
{

    public function creating(OvertimePolicyEmployee $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }

}
