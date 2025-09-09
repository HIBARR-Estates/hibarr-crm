<?php

namespace Modules\RestAPI\Entities;

use App\Observers\NoticeObserver;

class Notice extends \App\Models\Notice
{

    // region Properties

    protected $table = 'notices';

    protected $hidden = [
        'updated_at',
    ];

    protected $default = [
        'id',
        'heading',
    ];

    protected $filterable = [
        'id',
        'heading',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(NoticeObserver::class);
    }

    public function visibleTo(\App\Models\User $user)
    {
        if ($user->hasRole('admin')) {
            return true;
        }

        if ($user->hasRole('client')) {
            return $this->to === 'client';
        }

        if ($user->hasRole('employee')) {
            return $this->to === 'employee';
        }

        return true;
    }

    public function scopeVisibility($query)
    {
        $user = api_user();

        if ($user) {

            //phpcs:ignore
            if (isset($user->employee_details)) {
                $department_id = $user->employee_details->department_id;

            }
            else {
                $department_id = $user->employeeDetail->department_id;
            }

            if ($user->hasRole('admin')) {
                return $query;
            }

            if ($user->hasRole('client')) {
                $query->where('notices.to', 'client');
            }

            if ($user->hasRole('employee')) {
                $query->where('notices.to', 'employee')
                    ->where('notices.department_id', $department_id)
                    ->orWhereNull('notices.department_id');
            }
        }
    }

}
