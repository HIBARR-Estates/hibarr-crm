<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\SalaryGroupComponent;

class SalaryGroupComponentObserver
{
    public function creating(SalaryGroupComponent $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}
