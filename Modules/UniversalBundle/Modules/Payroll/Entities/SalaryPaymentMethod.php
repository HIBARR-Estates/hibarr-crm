<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;

class SalaryPaymentMethod extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];
}
