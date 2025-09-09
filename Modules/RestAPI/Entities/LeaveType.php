<?php

namespace Modules\RestAPI\Entities;

use App\Observers\LeaveTypeObserver;

class LeaveType extends \App\Models\LeaveType
{
    // region Properties

    protected $table = 'leave_types';

    protected $default = [
        'id',
        'type_name',
        'company_id',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'type_name',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(LeaveTypeObserver::class);
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

            if ($user->hasRole('admin') || $user->hasRole('employee')) {
                return $query;
            }
        }
    }
}
