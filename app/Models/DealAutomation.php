<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DealAutomation extends BaseModel
{
    use HasFactory;

    protected $table = 'deal_automations';

    protected $fillable = [
        'name',
        'pipeline_id',
        'trigger',
        'active',
        'priority',
    ];

    protected $casts = [
        'active' => 'boolean',
        'priority' => 'integer',
    ];

    /**
     * Get the pipeline associated with the automation.
     */
    public function pipeline(): BelongsTo
    {
        return $this->belongsTo(LeadPipeline::class, 'pipeline_id');
    }

    /**
     * Get the conditions for the automation.
     */
    public function conditions(): HasMany
    {
        return $this->hasMany(DealAutomationCondition::class, 'deal_automation_id');
    }

    /**
     * Get the actions for the automation.
     */
    public function actions(): HasMany
    {
        return $this->hasMany(DealAutomationAction::class, 'deal_automation_id');
    }
}
