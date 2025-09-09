<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeSalaryGroup extends BaseModel
{
    protected $guarded = ['id'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withoutGlobalScope(ActiveScope::class);
    }

    // phpcs:ignore
    public function salary_group(): BelongsTo
    {
        return $this->belongsTo(SalaryGroup::class, 'salary_group_id');
    }
}
