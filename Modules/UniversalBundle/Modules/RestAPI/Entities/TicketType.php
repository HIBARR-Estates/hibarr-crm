<?php

namespace Modules\RestAPI\Entities;

use App\Observers\TicketObserver;

class TicketType extends \App\Models\TicketType
{
    // region Properties

    protected $table = 'ticket_types';

    protected $fillable = [
        'type',
    ];

    protected $default = [
        'id',
        'type',
    ];

    protected $filterable = [
        'id',
        'type',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TicketObserver::class);
    }

    public function visibleTo(\App\Models\User $user)
    {
        if ($user->hasRole('admin') || $user->hasRole('employee')) {
            return true;
        }

        return false;
    }

    public function scopeVisibility($query)
    {
        if (api_user()) {
            return $query;
        }
    }
}
