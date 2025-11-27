<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MeetingType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'is_active',
        'company_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the meeting summaries for this meeting type.
     */
    public function meetingSummaries()
    {
        return $this->hasMany(MeetingSummary::class);
    }

    /**
     * Get the follow-ups for this meeting type.
     */
    public function followUps()
    {
        return $this->hasMany(DealFollowUp::class);
    }
}
