<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\SalaryPaymentMethod;

class SalaryPaymentMethodObserver
{
    public function creating(SalaryPaymentMethod $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}
