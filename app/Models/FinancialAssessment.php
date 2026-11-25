<?php

namespace App\Models;

use App\Enums\FinancialAssessmentSource;
use App\Enums\FinancialAssessmentStatus;
use App\Scopes\ActiveScope;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One dated snapshot of a lead's financial picture. Edited as a draft, frozen
 * as final (totals and exchange rates included), superseded by a newer final.
 */
class FinancialAssessment extends BaseModel
{
    use HasCompany, SoftDeletes;

    protected $table = 'financial_assessments';

    protected $fillable = [
        'company_id',
        'lead_id',
        'as_of_date',
        'status',
        'source',
        'currency',
        'prepared_by_user_id',
        'finalised_at',
        'verified_by_user_id',
        'verified_at',
        'available_now_override',
        'override_reason',
        'totals',
        'supersedes_assessment_id',
        'notes',
        'draft_lead_id',
        'current_lead_id',
    ];

    protected $casts = [
        'as_of_date' => 'date',
        'status' => FinancialAssessmentStatus::class,
        'source' => FinancialAssessmentSource::class,
        'finalised_at' => 'datetime',
        'verified_at' => 'datetime',
        'available_now_override' => 'decimal:2',
        'totals' => 'array',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(FinancialAssessmentLine::class, 'assessment_id')->orderBy('sort_order')->orderBy('id');
    }

    public function preparedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by_user_id')->withoutGlobalScope(ActiveScope::class);
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by_user_id')->withoutGlobalScope(ActiveScope::class);
    }

    public function supersedes(): BelongsTo
    {
        return $this->belongsTo(self::class, 'supersedes_assessment_id');
    }

    public function isDraft(): bool
    {
        return $this->status === FinancialAssessmentStatus::Draft;
    }

    public function isFinal(): bool
    {
        return $this->status === FinancialAssessmentStatus::Final;
    }
}
