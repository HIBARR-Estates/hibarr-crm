<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryGroupComponent extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];

    public function group(): BelongsTo
    {
        return $this->belongsTo(SalaryGroup::class);
    }

    public function component(): BelongsTo
    {
        return $this->belongsTo(SalaryComponent::class, 'salary_component_id');
    }
}
