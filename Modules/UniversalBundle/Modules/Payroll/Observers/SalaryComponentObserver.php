<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\SalaryComponent;

class SalaryComponentObserver
{
    public function creating(SalaryComponent $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}
