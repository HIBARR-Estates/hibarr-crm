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
        'meeting_type_ids',
        'wait_duration_value',
        'wait_duration_unit',
        'active',
        'priority',
        'condition_logic',
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
     * Fire when a meeting's attendance outcome is logged as "Attended"
     * (MeetingAttendanceConfirmationService — the confirmation prompt or the
     * meeting's own edit form). One trigger for both subjects: a meeting
     * attached to a deal runs the deal-scoped automations, a lead-only meeting
     * runs the lead-scoped ones (the automation's own subject type is the
     * differentiator). Used to send the Meta "Contact" conversion once a lead
     * actually shows up.
     */
    public const TRIGGER_MEETING_ATTENDED = 'meeting_attended';

    /**
     * Fires once per payment, when a deal's payment is confirmed as paid
     * (DealPaymentService::markConfirmed — online payment settled, bank
     * transfer confirmed, or OL pushing a completed payment). Used to send the
     * Meta "Purchase" conversion. Unlike every other deal trigger it still runs
     * for a deal that already has a paid request — that is exactly its moment.
     */
    public const TRIGGER_DEAL_PAYMENT_RECEIVED = 'deal_payment_received';

    /**
     * "Via API" triggers fire explicitly from the external, API-token-
     * authenticated write paths (DealContactApiController, DealCreationService)
     * — those paths persist with saveQuietly(), which never fires the normal
     * lead_created/lead_updated/deal_created/deal_updated triggers at all, so
     * an automation that needs to react to API-originated records has no
     * other way to see them. See DealAutomationService::processLead()/
     * process() call sites in those classes for exactly what fires each one.
     */
    public const TRIGGER_LEAD_CREATED_API = 'lead_created_api';

    public const TRIGGER_LEAD_UPDATED_API = 'lead_updated_api';

    public const TRIGGER_DEAL_CREATED_API = 'deal_created_api';

    public const TRIGGER_DEAL_UPDATED_API = 'deal_updated_api';

    /**
     * How a date_based trigger repeats: on the matching month/day every year
     * (birthdays/anniversaries) or only on the exact date, once ever.
     */
    public const DATE_RECURRENCE_YEARLY = 'yearly';

    public const DATE_RECURRENCE_ONCE = 'once';

    /**
     * How an automation's conditions combine: ALL requires every condition to
     * pass (the historical, and still default, behavior); ANY requires just
     * one. Shared by DealAutomationService and LeadAutomationService.
     */
    public const CONDITION_LOGIC_ALL = 'all';

    public const CONDITION_LOGIC_ANY = 'any';

    protected $casts = [
        'active' => 'boolean',
        'priority' => 'integer',
        'meeting_type_ids' => 'array',
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
