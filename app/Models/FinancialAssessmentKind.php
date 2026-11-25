<?php

namespace App\Models;

use App\Enums\FinancialKindRole;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A configurable kind of financial assessment line (income, savings, ...).
 * Its role decides how the calculator counts every line of its types.
 */
class FinancialAssessmentKind extends BaseModel
{
    use HasCompany;

    protected $table = 'financial_assessment_kinds';

    protected $fillable = [
        'company_id',
        'key',
        'label',
        'role',
        'sort_order',
        'is_active',
        'is_system',
    ];

    protected $casts = [
        'role' => FinancialKindRole::class,
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'is_system' => 'boolean',
    ];

    public function types(): HasMany
    {
        return $this->hasMany(FinancialAssessmentLineType::class, 'kind_id')->orderBy('sort_order')->orderBy('id');
    }
}
