<?php

namespace Modules\RestAPI\Entities;

use App\Observers\LeaveObserver;

class Leave extends \App\Models\Leave
{
    // region Properties

    protected $table = 'leaves';

    protected $default = [
        'id',
        'leave_type_id',
        'leave_date',
        'reason',
        'status',
    ];

    protected $hidden = [
        'leave.leave_type_id',
    ];

    protected $dates = [
        'leave_date',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'status',
        'user_id',
        'leave_type_id',
        'employee_name',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(LeaveObserver::class);
    }

    public function visibleTo(\App\Models\User $user)
    {
        if ($user->hasRole('admin') || $user->hasRole('employee') || $user->cans('view_leave')) {
            return true;
        }

        return false;
    }

    public function scopeVisibility($query)
    {
        if (api_user()) {
            $user = api_user();

            if ($user->hasRole('admin')) {
                return $query;
            }

            if ($user->hasRole('employee')) {
                $query->where('user_id', $user->id);

                return $query;
            }
        }
    }
}
