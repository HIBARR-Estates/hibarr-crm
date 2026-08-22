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
        'subject_type',
        'trigger',
        'date_field',
        'date_recurrence',
        'active',
        'priority',
    ];

    /**
     * Subject-type constants — which model this automation runs against.
     */
    public const SUBJECT_DEAL = 'deal';

    public const SUBJECT_LEAD = 'lead';

    /**
     * Trigger constants. TRIGGER_DATE_BASED fires from the daily scheduler
     * (deal-automations:process-date-triggers) when a record's configured date
     * field matches — birthdays, anniversaries, one-off dates.
     */
    public const TRIGGER_DATE_BASED = 'date_based';

    public const TRIGGER_LEAD_FOLLOWUP_CREATED = 'lead_followup_created';

    /**
     * How a date_based trigger repeats: on the matching month/day every year
     * (birthdays/anniversaries) or only on the exact date, once ever.
     */
    public const DATE_RECURRENCE_YEARLY = 'yearly';

    public const DATE_RECURRENCE_ONCE = 'once';

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
