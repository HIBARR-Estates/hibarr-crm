<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;

class SalaryTds extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];

    public $table = 'salary_tds';
}
