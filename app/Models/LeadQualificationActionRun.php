<?php

namespace App\Models;

use App\Enums\QualificationActionRunStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadQualificationActionRun extends BaseModel
{
    protected $fillable = [
        'lead_qualification_id',
        'action_type',
        'status',
        'config',
        'payload',
        'error',
        'completed_at',
    ];

    protected $casts = [
        'status' => QualificationActionRunStatus::class,
        'config' => 'array',
        'payload' => 'array',
        'completed_at' => 'datetime',
    ];

    public function qualification(): BelongsTo
    {
        return $this->belongsTo(LeadQualification::class, 'lead_qualification_id');
    }
}
