<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalaryGroup extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];

    public function components(): HasMany
    {
        return $this->hasMany(SalaryGroupComponent::class);
    }

    public function employee(): HasMany
    {
        return $this->hasMany(EmployeeSalaryGroup::class, 'salary_group_id');
    }

    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(EmployeeSalaryGroup::class, 'employee_salary_groups', 'salary_group_id', 'user_id');
    }
}
