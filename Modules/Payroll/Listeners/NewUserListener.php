<?php

namespace Modules\Payroll\Listeners;

use App\Events\NewUserEvent;
use Modules\Payroll\Entities\EmployeePayrollCycle;
use Modules\Payroll\Entities\PayrollCycle;

class NewUserListener
{
    public function handle(NewUserEvent $event)
    {
        $payrollCycle = PayrollCycle::first();

        if ($payrollCycle && $event->user->company) {
            EmployeePayrollCycle::firstOrCreate([
                'user_id' => $event->user->id,
                'company_id' => $event->user->company->id,
                'payroll_cycle_id' => $payrollCycle->id,
            ]);
        }
    }
}
