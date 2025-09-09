<?php

namespace Modules\Webhooks\Observers;

use App\Models\EmployeeDetails;
use Modules\Webhooks\Jobs\SendWebhook;

class EmployeeDetailsObserver
{

    public function created(EmployeeDetails $employeeDetails)
    {
        $data = $employeeDetails->toArray();
        $user = $employeeDetails->user->toArray();
        $data = array_merge($data, $user);

        SendWebhook::dispatch($data, 'Employee', $employeeDetails->company_id)
            ->delay(5)
            ->onQueue('default');
    }

}
