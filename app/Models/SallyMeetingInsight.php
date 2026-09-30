<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SallyMeetingInsight extends Model
{
    use HasCompany;

    protected $fillable = [
        'company_id',
        'meeting_follow_up_id',
        'lead_id',
        'deal_id',
        'summary',
        'transcript',
        'transcript_segments',
        'bullet_points',
    ];

    protected $casts = [
        'transcript_segments' => 'array',
        'bullet_points' => 'array',
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
}
