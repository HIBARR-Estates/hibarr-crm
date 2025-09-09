<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;

class PayrollCycle extends BaseModel
{
    protected $guarded = ['id'];

    public $table = 'payroll_cycles';
}
