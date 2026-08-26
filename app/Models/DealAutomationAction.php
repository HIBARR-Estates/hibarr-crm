<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DealAutomationAction extends BaseModel
{
    use HasFactory;

    protected $table = 'deal_automation_actions';

    // Mass assignable attributes
    protected $fillable = [
        'deal_automation_id',
        'action_type',
        'target_stage_id',
        'target_pipeline_id',
        'forward_only',
        'field_name',
        'field_value',
        'payload',
    ];

    protected $casts = [
        'forward_only' => 'boolean',
        'payload' => 'array',
    ];

    /**
     * Get the automation that owns the action.
     */
    public function automation(): BelongsTo
    {
        return $this->belongsTo(DealAutomation::class, 'deal_automation_id');
    }

    /**
     * Get the target stage for the action.
     */
    public function targetStage(): BelongsTo
    {
        return $this->belongsTo(PipelineStage::class, 'target_stage_id');
    }

    /**
     * Get the target pipeline for the action.
     */
    public function targetPipeline(): BelongsTo
    {
        return $this->belongsTo(LeadPipeline::class, 'target_pipeline_id');
    }
}
