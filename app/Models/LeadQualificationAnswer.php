<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadQualificationAnswer extends BaseModel
{
    protected $fillable = [
        'lead_qualification_id',
        'segment_key',
        'answer_values',
        'answer_text',
    ];

    protected $casts = [
        'answer_values' => 'array',
    ];

    public function qualification(): BelongsTo
    {
        return $this->belongsTo(LeadQualification::class, 'lead_qualification_id');
    }
}
