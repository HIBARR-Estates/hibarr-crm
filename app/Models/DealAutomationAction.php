<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DealAutomationAction extends BaseModel
{
    use HasFactory;

    protected $table = 'deal_automation_actions';

    protected $fillable = [
        'deal_automation_id',
        'target_stage_id',
        'target_pipeline_id',
        'forward_only',
    ];

    protected $casts = [
        'forward_only' => 'boolean',
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
