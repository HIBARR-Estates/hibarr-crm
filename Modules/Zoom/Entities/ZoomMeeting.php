<?php

namespace Modules\Zoom\Entities;

use App\Models\BaseModel;
use App\Models\Project;
use App\Models\User;
use App\Traits\HasCompany;

class ZoomMeeting extends BaseModel
{
    use HasCompany;

    protected $table = 'zoom_meetings';

    protected $guarded = ['id'];

    protected $dates = ['start_date_time', 'end_date_time'];

    public function attendees()
    {
        return $this->belongsToMany(User::class, 'user_zoom_meeting', 'zoom_meeting_id', 'user_id');
    }

    public function host()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function category()
    {
        return $this->belongsTo(ZoomCategory::class, 'category_id');

    }

    public function project()
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function notes()
    {
        return $this->hasMany(ZoomMeetingNote::class, 'zoom_meeting_id')->orderByDesc('id');
    }
}
