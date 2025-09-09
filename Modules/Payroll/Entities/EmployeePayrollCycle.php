<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;

class EmployeePayrollCycle extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];

    public $table = 'employee_payroll_cycles';
}
