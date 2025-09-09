<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\EmployeeMonthlySalary;

class EmployeeMonthlySalaryObserver
{

    public function creating(EmployeeMonthlySalary $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }

}
