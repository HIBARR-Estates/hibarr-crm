<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\PayrollSetting;

class PayrollSettingObserver
{
    public function creating(PayrollSetting $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}
