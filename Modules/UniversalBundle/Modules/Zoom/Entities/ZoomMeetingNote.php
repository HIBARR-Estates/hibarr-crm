<?php

namespace Modules\Zoom\Entities;

use App\Models\BaseModel;
use App\Models\User;
use App\Traits\HasCompany;

class ZoomMeetingNote extends BaseModel
{
    use HasCompany;

    protected $table = 'zoom_meeting_notes';

    protected $guarded = ['id'];

    protected $with = ['user'];

    protected $dates = ['start_date_time', 'end_date_time'];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id')->withoutGlobalScope(ActiveScope::class);
    }

    public function meeting()
    {
        return $this->belongsTo(ZoomMeeting::class, 'zoom_meeting_id');
    }
}
