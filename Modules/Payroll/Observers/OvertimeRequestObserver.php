<?php

namespace Modules\Payroll\Observers;

use Modules\Payroll\Entities\OvertimeRequest;

class OvertimeRequestObserver
{

    public function creating(OvertimeRequest $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }

}
