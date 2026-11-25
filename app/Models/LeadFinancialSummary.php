<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Read model: one row per lead, projected from its current final assessment
 * so filters, sorting, automations and the API read one indexed row.
 */
class LeadFinancialSummary extends BaseModel
{
    use HasCompany;

    protected $table = 'lead_financial_summaries';

    protected $primaryKey = 'lead_id';

    public $incrementing = false;

    protected $guarded = [];

    protected $casts = [
        'as_of_date' => 'date',
        'finalised_at' => 'datetime',
        'refresh_due_on' => 'date',
        'verified' => 'boolean',
        'verified_at' => 'datetime',
        'available_now' => 'decimal:2',
        'available_now_overridden' => 'boolean',
        'available_projected' => 'decimal:2',
        'uncertain_total' => 'decimal:2',
        'income_monthly' => 'decimal:2',
        'commitments_monthly' => 'decimal:2',
        'disposable_monthly' => 'decimal:2',
        'assets_total' => 'decimal:2',
        'funding_total' => 'decimal:2',
        'by_kind' => 'array',
        'by_type' => 'array',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function assessment(): BelongsTo
    {
        return $this->belongsTo(FinancialAssessment::class, 'current_assessment_id');
    }
}
