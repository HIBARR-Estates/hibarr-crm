<?php

namespace App\Models;

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
 * @property string|null $event_id
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereEventId($value)
 * @property string|null $meeting_id
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereMeetingId($value)
 * @property string|null $send_reminder
 * @property string|null $remind_time
 * @property string|null $remind_type
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereRemindTime($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereRemindType($value)
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereSendReminder($value)
 * @property-read \App\Models\User|null $addedBy
 * @property string|null $status
 * @method static \Illuminate\Database\Eloquent\Builder|DealFollowUp whereStatus($value)
 * @mixin \Eloquent
 */
class DealFollowUp extends BaseModel
{
    protected $table = 'lead_follow_up';
    protected $hidden = ["pivot"];


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
    ];

    protected $casts = [
        'next_follow_up_date' => 'datetime',
        'created_at' => 'datetime',
        'reminders' => 'array',  // Cast JSON to array
        'participants' => 'array',  // Cast JSON to array
        'duration' => 'integer',
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

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
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
     * 
     * @param int $userId
     * @return array
     */
    public function getEffectiveReminders(int $userId): array
    {
        // If this follow-up has explicit custom reminders set, use them
        // This preserves backward compatibility with per-meeting overrides
        if (!empty($this->reminders)) {
            // Merge default reminders with custom reminders for this specific meeting
            return $this->getAllReminders();
        }

        // Otherwise, use the user's personal reminder preferences
        return UserReminderPreference::getRemindersForUser($userId, 'meeting');
    }

}
