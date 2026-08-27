<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadAutomationAction extends BaseModel
{
    use HasFactory;

    protected $table = 'lead_automation_actions';

    protected $fillable = [
        'lead_automation_id',
        'action_type',
        'payload',
        'priority',
    ];

    protected $casts = [
        'payload' => 'array',
        'priority' => 'integer',
    ];

    public function automation(): BelongsTo
    {
        return $this->belongsTo(LeadAutomation::class, 'lead_automation_id');
    }
}
