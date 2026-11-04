<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadQualificationAnswer extends BaseModel
{
    protected $fillable = [
        'lead_qualification_id',
        'segment_key',
        'question_label',
        'answer_values',
        'answer_labels',
        'answer_text',
    ];

    protected $casts = [
        'answer_values' => 'array',
        'answer_labels' => 'array',
    ];

    public function qualification(): BelongsTo
    {
        return $this->belongsTo(LeadQualification::class, 'lead_qualification_id');
    }
}
