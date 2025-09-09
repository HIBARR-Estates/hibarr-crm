<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\SalaryTds;

class SalaryTdsObserver
{
    public function creating(SalaryTds $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}
