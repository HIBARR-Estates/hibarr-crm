<?php

namespace Modules\Payroll\Entities;

use App\Models\BaseModel;
use App\Models\Company;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OvertimePolicy extends BaseModel
{
    use HasCompany;

    protected $guarded = ['id'];

    protected $casts = [
        'allow_roles' => 'array', // This will automatically cast JSON to array
    ];

    public function payCode(): BelongsTo
    {
        return $this->belongsTo(PayCode::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

}
