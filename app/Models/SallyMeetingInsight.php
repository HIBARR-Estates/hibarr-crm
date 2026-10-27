<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SallyMeetingInsight extends Model
{
    use HasCompany;

    /**
     * Sally's generated note kinds (see
     * docs/briefs/2026-10-26-sally-insights-ol-backend-work.md).
     */
    public const SUGGESTION_TYPES = ['objection', 'decision', 'insight', 'meeting_type'];

    protected $fillable = [
        'company_id',
        'meeting_follow_up_id',
        'lead_id',
        'deal_id',
        'summary',
        'transcript',
        'transcript_segments',
        'bullet_points',
        'recording_url',
        'original_summary',
        'original_bullet_points',
        'suggested_notes',
        'original_suggested_notes',
        'summary_edited_at',
        'bullet_points_edited_at',
    ];

    protected $casts = [
        'transcript_segments' => 'array',
        'bullet_points' => 'array',
        'suggested_notes' => 'array',
        'original_bullet_points' => 'array',
        'original_suggested_notes' => 'array',
        'summary_edited_at' => 'datetime',
        'bullet_points_edited_at' => 'datetime',
    ];

    public function meetingFollowUp(): BelongsTo
    {
        return $this->belongsTo(DealFollowUp::class, 'meeting_follow_up_id');
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    /**
     * Which suggestions an agent already turned into CRM notes. Keyed by the
     * OL-stable suggestion id; the row is the source of truth for "logged".
     */
    public function suggestionLogs(): HasMany
    {
        return $this->hasMany(SallySuggestionLog::class);
    }
}
