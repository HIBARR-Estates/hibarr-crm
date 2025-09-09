<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\SalarySlip;

class SalarySlipObserver
{

    public function saving(SalarySlip $model)
    {
        if (user()) {
            $model->last_updated_by = user()->id;
        }
    }

    public function creating(SalarySlip $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }

}
