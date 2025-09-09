<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\PayCode;

class PayCodeObserver
{

    public function creating(PayCode $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }

}
