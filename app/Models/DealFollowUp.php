<?php

namespace App\Models;

use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\DealFollowUp
 *
 * @property int $id
 * @property int $deal_id
 * @property int|null $meeting_type_id
 * @property string|null $remark
 * @property \Illuminate\Support\Carbon|null $next_follow_up_date
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property int|null $added_by
 * @property int|null $last_updated_by
 * @property-read mixed $icon
 * @property-read \App\Models\Deal $deal
 * @property-read \App\Models\MeetingType|null $meetingType
 *
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp query()
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereAddedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereLastUpdatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereDealId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereMeetingTypeId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereNextFollowUpDate($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereRemark($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereUpdatedAt($value)
 *
 * @property string|null $event_id
 *
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereEventId($value)
 *
 * @property string|null $meeting_id
 *
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereMeetingId($value)
 *
 * @property string|null $send_reminder
 * @property string|null $remind_time
 * @property string|null $remind_type
 *
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereRemindTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereRemindType($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereSendReminder($value)
 *
 * @property-read \App\Models\User|null $addedBy
 * @property string|null $status
 *
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereStatus($value)
 *
 * @property string|null $attendance_outcome
 * @property \Illuminate\Support\Carbon|null $attendance_outcome_logged_at
 * @property int|null $attendance_outcome_logged_by
 * @property \Illuminate\Support\Carbon|null $attendance_confirmation_snoozed_until
 * @property int|null $host_id
 *
 * Set by attachParticipantUsers(), not columns — the meeting modals read both.
 *
 * @property int $effective_duration
 * @property array $participant_users
 *
 * @mixin \Eloquent
 */
class DealFollowUp extends BaseModel
{
    protected $table = 'lead_follow_up';

    protected $hidden = ['pivot'];

    protected $fillable = [
        'deal_id',
        'lead_id',  // Keep for backward compatibility
        'meeting_type_id',
        'location',
        'meeting_link',
        'remark',
        'meeting_type',
        'next_follow_up_date',
        'duration',
        'added_by',
        'last_updated_by',
        'event_id',
        'meeting_id',
        'summary_id',
        'zoho_calendar_job_id',
        'zoho_calendar_sync_status',
        'zoho_calendar_event_uid',
        'send_reminder',
        'remind_time',
        'remind_type',
        'reminders',  // New JSON field for multiple reminders
        'participants',  // JSON field for meeting participants (user IDs)
        'status',
        'duration',  // Meeting duration in minutes (nullable, defaults to 30)
        'attendance_outcome',
        'attendance_outcome_logged_at',
        'attendance_outcome_logged_by',
        'attendance_confirmation_snoozed_until',
        'host_id',
        'client_attended',  // Tri-state: null = unconfirmed, true/false = manually confirmed
    ];

    protected $casts = [
        'next_follow_up_date' => 'datetime',
        'created_at' => 'datetime',
        'reminders' => 'array',  // Cast JSON to array
        'participants' => 'array',  // Cast JSON to array
        'duration' => 'integer',
        'attendance_outcome_logged_at' => 'datetime',
        'attendance_outcome_logged_by' => 'integer',
        'attendance_confirmation_snoozed_until' => 'datetime',
        'host_id' => 'integer',
        'client_attended' => 'boolean',
    ];

    /** Default meeting duration (minutes) when none is set */
    public const DEFAULT_DURATION_MINUTES = 30;

    public const ZOHO_CALENDAR_SYNC_PENDING = 'pending';

    public const ZOHO_CALENDAR_SYNC_SYNCED = 'synced';

    public const ZOHO_CALENDAR_SYNC_FAILED = 'failed';

    // Default reminders that cannot be edited or deleted
    public const DEFAULT_REMINDERS = [
        ['time' => 1, 'type' => 'hour', 'is_default' => true],
        ['time' => 30, 'type' => 'minute', 'is_default' => true],
        ['time' => 15, 'type' => 'minute', 'is_default' => true],
        ['time' => 5, 'type' => 'minute', 'is_default' => true],
    ];

    /**
     * Get all reminders including defaults
     */
    public function getAllReminders()
    {
        $customReminders = $this->reminders ?? [];

        return array_merge(self::DEFAULT_REMINDERS, $customReminders);
    }

    /**
     * Set custom reminders (defaults are always included)
     */
    public function setCustomReminders(array $customReminders)
    {
        // Filter out any attempts to set is_default = true
        $customReminders = array_map(function ($reminder) {
            unset($reminder['is_default']);

            return $reminder;
        }, $customReminders);

        $this->reminders = $customReminders;
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    /**
     * Get the effective meeting duration in minutes.
     * Falls back to DEFAULT_DURATION_MINUTES (30) when not explicitly set.
     */
    public function getEffectiveDuration(): int
    {
        return $this->duration ?? self::DEFAULT_DURATION_MINUTES;
    }

    /**
     * Computed end time (next_follow_up_date + effective duration). Null when
     * the meeting has no scheduled date. There is no end_time column.
     */
    public function getEndTime(): ?\Carbon\CarbonInterface
    {
        if (!$this->next_follow_up_date) {
            return null;
        }

        return $this->next_follow_up_date->copy()->addMinutes($this->getEffectiveDuration());
    }

    /**
     * The user this meeting is "assigned" to for prompts/reminders: the deal's
     * lead agent, falling back to the lead owner for lead-only follow-ups.
     * Mirrors MeetingReminderSync::buildRecipients()'s resolution.
     */
    public function assignedAgentUserId(): ?int
    {
        $this->loadMissing(['deal.leadAgent', 'lead']);

        $agentUserId = $this->deal?->leadAgent?->user_id ?? $this->lead?->lead_owner;

        return $agentUserId ? (int) $agentUserId : null;
    }

    /**
     * Who the attendance-confirmation prompt goes to: this meeting's host
     * when crm.meeting-host is on and one was resolved for this row,
     * otherwise the same deal-agent/lead-owner assignedAgentUserId() uses
     * (also the fallback for rows saved while the flag was off, since
     * host_id is never populated for them).
     */
    public function confirmationAssigneeUserId(): ?int
    {
        if (\App\Support\FeatureFlags::enabled('crm.meeting-host') && $this->host_id) {
            return (int) $this->host_id;
        }

        return $this->assignedAgentUserId();
    }

    /**
     * Default host for a NEW meeting when the request doesn't choose one
     * explicitly: same resolution as assignedAgentUserId(), falling back to
     * the meeting's creator. Create-time only — host_id is immutable after
     * save (DealController::updateFollow never reads or writes it).
     */
    public function defaultHostUserId(): int
    {
        return $this->assignedAgentUserId() ?? $this->added_by ?? (int) user()->id;
    }

    /**
     * Whether this follow-up's deal or lead belongs to $companyId. Route-model
     * binding by ID alone doesn't scope by company (this model has no
     * CompanyScope), so callers that authorize by ID — the attendance
     * confirmation endpoints — need this alongside assignedAgentUserId() to
     * reject a follow-up from a company the requesting user isn't in.
     */
    public function belongsToCompany(int $companyId): bool
    {
        $this->loadMissing(['deal', 'lead']);

        return ($this->deal && (int) $this->deal->company_id === $companyId)
            || ($this->lead && (int) $this->lead->company_id === $companyId);
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_id');
    }

    /**
     * Resolve the participants JSON into the {id, name, image, email} rows the
     * meeting modals read, and stamp the effective duration.
     *
     * One query for the whole collection rather than one per follow-up.
     *
     * ponytail: four inline copies of this already exist (DealController:1057
     * and :2431, LeadContactController:364, MeetingsController:153). Collapse
     * them onto this the next time one of those files is touched for another
     * reason — a four-controller diff does not belong in a dashboard change.
     *
     * @param  \Illuminate\Support\Collection<int, self>  $followUps
     */
    public static function attachParticipantUsers($followUps): void
    {
        $userIds = $followUps
            ->flatMap(fn (self $followUp) => $followUp->participants ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values();

        // ActiveScope is dropped for the same reason Task::users() drops it: an
        // attendee list is a record of who was in the meeting. Hiding someone
        // because they have since been deactivated rewrites history and leaves
        // the modal showing fewer attendees than actually attended.
        // User eager-loads session and clientContact by default; an attendee
        // chip needs neither. Dropping them saves two queries and a chunk of
        // payload on every participant of every meeting.
        $users = $userIds->isEmpty()
            ? collect()
            : User::withoutGlobalScope(ActiveScope::class)
                ->without(['session', 'clientContact'])
                ->whereIn('id', $userIds)
                ->get(['id', 'name', 'image', 'email'])
                ->keyBy('id');

        $followUps->each(function (self $followUp) use ($users) {
            $followUp->effective_duration = $followUp->getEffectiveDuration();
            $followUp->participant_users = collect($followUp->participants ?? [])
                ->map(fn ($id) => $users->get((int) $id))
                ->filter()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'image_url' => $user->image_url,
                ])
                ->values()
                ->toArray();
        });
    }

    /**
     * Meetings visible to a user as creator or JSON participant.
     */
    public function scopeVisibleToUser($query, int $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('added_by', $userId)
                ->orWhereJsonContains('participants', $userId)
                ->orWhereJsonContains('participants', (string) $userId);
        });
    }

    public function isCreatedBy(int $userId): bool
    {
        return (int) $this->added_by === $userId;
    }

    public function hasParticipant(int $userId): bool
    {
        $participants = $this->participants ?? [];

        return in_array($userId, $participants, true)
            || in_array((string) $userId, $participants, true);
    }

    public function isVisibleToUser(int $userId): bool
    {
        return $this->isCreatedBy($userId) || $this->hasParticipant($userId);
    }

    public function meetingType(): BelongsTo
    {
        return $this->belongsTo(MeetingType::class);
    }

    public function meetingSummary(): BelongsTo
    {
        return $this->belongsTo(MeetingSummary::class, 'summary_id');
    }

    /**
     * Get effective reminders for a specific user
     *
     * Priority:
     * 1. Per-meeting custom reminders (if explicitly set via reminders field)
     * 2. User's personal reminder preferences
     * 3. System defaults (via UserReminderPreference::DEFAULT_REMINDERS)
     */
    public function getEffectiveReminders(int $userId): array
    {
        // If this follow-up has explicit custom reminders set, use them
        // This preserves backward compatibility with per-meeting overrides
        if (! empty($this->reminders)) {
            // Merge default reminders with custom reminders for this specific meeting
            return $this->getAllReminders();
        }

        // Otherwise, use the user's personal reminder preferences
        return UserReminderPreference::getRemindersForUser($userId, 'meeting');
    }
}
