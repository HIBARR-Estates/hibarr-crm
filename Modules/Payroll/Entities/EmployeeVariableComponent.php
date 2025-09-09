<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeVariableComponent extends BaseModel
{
    use HasFactory;

    public $table = 'employee_variable_salaries';

    public function component(): BelongsTo
    {
        return $this->belongsTo(SalaryComponent::class, 'variable_component_id');
    }
}
