<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DealAutomationCondition extends BaseModel
{
    use HasFactory;

    protected $table = 'deal_automation_conditions';

    protected $fillable = [
        'deal_automation_id',
        'field',
        'operator',
        'value',
    ];

    protected $casts = [
        'value' => 'array',
    ];

    /**
     * Get the automation that owns the condition.
     */
    public function automation(): BelongsTo
    {
        return $this->belongsTo(DealAutomation::class, 'deal_automation_id');
    }
}
