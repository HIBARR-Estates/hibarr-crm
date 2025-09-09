<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\SalaryGroup;

class SalaryGroupObserver
{
    public function creating(SalaryGroup $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}
