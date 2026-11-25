<?php

namespace App\Models;

use App\Enums\FinancialLineCertainty;
use App\Enums\FinancialLineFrequency;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class FinancialAssessmentLine extends BaseModel
{
    use HasCompany, SoftDeletes;

    protected $table = 'financial_assessment_lines';

    protected $fillable = [
        'company_id',
        'assessment_id',
        'type_id',
        'amount',
        'currency',
        'frequency',
        'available_from',
        'certainty',
        'contributor_label',
        'contributor_lead_id',
        'proof_file_id',
        'note',
        'previous_line_id',
        'sort_order',
    ];

    protected $casts = [
        'amount' => 'decimal:8',
        'frequency' => FinancialLineFrequency::class,
        'certainty' => FinancialLineCertainty::class,
        'available_from' => 'date',
        'sort_order' => 'integer',
    ];

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(FinancialAssessment::class, 'assessment_id');
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(FinancialAssessmentLineType::class, 'type_id');
    }

    public function previous(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_line_id');
    }
}
