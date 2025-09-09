<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\EmployeePayrollCycle;

class EmployeePayrollCycleObserver
{
    public function creating(EmployeePayrollCycle $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}
