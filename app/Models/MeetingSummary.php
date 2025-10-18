<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MeetingSummary extends Model
{
    use HasFactory;

    protected $table = 'meeting_summary';

    protected $fillable = [
        'summary_object',
        'meeting_type_id',
        'deal_id',
    ];

    protected $casts = [
        'summary_object' => 'array',
    ];

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
