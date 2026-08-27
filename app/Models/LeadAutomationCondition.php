<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadAutomationCondition extends BaseModel
{
    use HasFactory;

    protected $table = 'lead_automation_conditions';

    protected $fillable = [
        'lead_automation_id',
        'field',
        'operator',
        'value',
    ];

    protected $casts = [
        'value' => 'array',
    ];

    public function automation(): BelongsTo
    {
        return $this->belongsTo(LeadAutomation::class, 'lead_automation_id');
    }
}
