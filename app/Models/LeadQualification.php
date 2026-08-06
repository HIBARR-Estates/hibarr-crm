<?php

namespace App\Models;

use App\Enums\QualificationOutcome;
use App\Enums\QualificationStatus;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeadQualification extends BaseModel
{
    use HasCompany;

    protected $fillable = [
        'company_id',
        'lead_id',
        'template_id',
        'template_version',
        'template_name',
        'agent_id',
        'status',
        'selected_branch_keys',
        'outcome',
        'outcomes',
        'outcome_comment',
        'outcome_triggered_at',
        'agent_language',
        'current_segment_key',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'status' => QualificationStatus::class,
        'outcome' => QualificationOutcome::class,
        'outcomes' => 'array',
        'selected_branch_keys' => 'array',
        'template_version' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'outcome_triggered_at' => 'datetime',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id')->withoutGlobalScope(ActiveScope::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(LeadQualificationAnswer::class, 'lead_qualification_id');
    }
}
