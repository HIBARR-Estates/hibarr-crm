<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\OvertimePolicy;
use Modules\Payroll\Entities\PayCode;

class OvertimePolicyObserver
{

    public function creating(OvertimePolicy $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }

}
