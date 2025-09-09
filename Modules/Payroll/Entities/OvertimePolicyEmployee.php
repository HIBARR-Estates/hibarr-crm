<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Models\Company;
use App\Models\User;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OvertimePolicyEmployee extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];

    public function policy(): BelongsTo
    {
        return $this->belongsTo(OvertimePolicy::class, 'overtime_policy_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

}
