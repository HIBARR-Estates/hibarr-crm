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

    protected $fillable = [
        'deal_id',
        'meeting_type_id',
        'remark',
        'next_follow_up_date',
        'send_reminder',
        'remind_time',
        'remind_type',
        'status'
    ];

    protected $casts = [
        'next_follow_up_date' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }

    public function meetingType(): BelongsTo
    {
        return $this->belongsTo(MeetingType::class, 'meeting_type_id');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

}
