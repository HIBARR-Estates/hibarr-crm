<?php

namespace Modules\RestAPI\Entities;

use App\Observers\ProjectTimelogObserver;
use Carbon\Carbon;

class ProjectTimeLog extends \App\Models\ProjectTimeLog
{
    public function __construct($attributes = [])
    {
        $this->appends = array_merge(['timer_start_time'], $this->appends);
        parent::__construct($attributes);
    }

    // region Properties

    protected $table = 'project_time_logs';

    protected $dates = ['start_time', 'end_time'];

    protected $hidden = [
        'updated_at',
    ];

    protected $default = [
        'id',
        'start_time',
        'end_time',
        'memo',
        'task_id',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'project_id',
        'task_id',
        'start_time',
        'end_time',
        'user_id',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(ProjectTimelogObserver::class);
    }

    public function getTimerStartTimeAttribute()
    {
        $settings = \company();

        return Carbon::parse($this->start_time)->timezone($settings->timezone);
    }

    public function visibleTo(\App\Models\User $user)
    {
        if ($user->hasRole('employee') || $user->cans('view_tasks')) {
            return true;
        }
    }

    public function scopeVisibility($query)
    {
        return $query;
    }
}
