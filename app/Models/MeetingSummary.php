<?php

namespace App\Models;

use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MeetingSummary extends Model
{
    use HasFactory;

    protected $table = 'meeting_summary';

    public const SOURCE_AI = 'ai';

    public const SOURCE_MANUAL = 'manual';

    protected $fillable = [
        'summary_object',
        'meeting_type_id',
        'deal_id',
        'source',
        'ai_summary_object',
        'edited_by',
        'edited_at',
    ];

    protected $casts = [
        'summary_object' => 'array',
        // The latest automatic summary that arrived while a person's own
        // version was in place — kept, not shown, so it can be taken later.
        'ai_summary_object' => 'array',
        'edited_at' => 'datetime',
    ];

    /**
     * Who wrote or last corrected it, when a person did.
     */
    public function editor()
    {
        return $this->belongsTo(User::class, 'edited_by')
            ->withoutGlobalScope(ActiveScope::class)
            ->select(['id', 'name']);
    }

    /**
     * Get the deal that owns the meeting summary.
     */
    public function deal()
    {
        return $this->belongsTo(Deal::class);
    }

    /**
     * Get the meeting type for the meeting summary.
     */
    public function meetingType()
    {
        return $this->belongsTo(MeetingType::class);
    }

    /**
     * Get the follow-ups for this meeting summary.
     */
    public function followUps()
    {
        return $this->hasMany(DealFollowUp::class, 'summary_id');
    }
}
