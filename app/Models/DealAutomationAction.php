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
        'email_template_id',
        'title',
        'content',
        'assignee_type',
        'assignee_user_id',
        'assigner_type',
        'assigner_user_id',
        'recipient_types',
        'recipient_user_ids',
        'recipient_emails',
        'meta_event_name',
        'meta_event_value',
        'due_date_delta_value',
        'due_date_delta_unit',
        'due_time',
    ];

    protected $casts = [
        'forward_only' => 'boolean',
        'recipient_types' => 'array',
        'recipient_user_ids' => 'array',
        'meta_event_value' => 'float',
        'due_date_delta_value' => 'integer',
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

    /**
     * Get the email template used by a send_email action.
     */
    public function emailTemplate(): BelongsTo
    {
        return $this->belongsTo(EmailTemplate::class, 'email_template_id');
    }

    /**
     * The specific user a create_task action assigns to, when assignee_type = specific_user.
     */
    public function assigneeUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }

    /**
     * The specific user a create_task/create_note action attributes the record to,
     * when assigner_type = specific_user.
     */
    public function assignerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigner_user_id');
    }
}
