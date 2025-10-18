<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    public function meetingType(): BelongsTo
    {
        return $this->belongsTo(MeetingType::class, 'meeting_type_id');
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }
}
