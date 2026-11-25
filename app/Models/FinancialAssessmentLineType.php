<?php

namespace App\Models;

use App\Enums\FinancialLineCertainty;
use App\Enums\FinancialLineFrequency;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A configurable type of line inside a kind (salary, bank, property sale, ...).
 * The key is fixed once created so API mappings keep working; the label can change.
 */
class FinancialAssessmentLineType extends BaseModel
{
    use HasCompany;

    protected $table = 'financial_assessment_line_types';

    protected $fillable = [
        'company_id',
        'kind_id',
        'key',
        'label',
        'default_frequency',
        'default_certainty',
        'sort_order',
        'is_active',
        'is_system',
    ];

    protected $casts = [
        'default_frequency' => FinancialLineFrequency::class,
        'default_certainty' => FinancialLineCertainty::class,
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'is_system' => 'boolean',
    ];

    public function kind(): BelongsTo
    {
        return $this->belongsTo(FinancialAssessmentKind::class, 'kind_id');
    }
}
