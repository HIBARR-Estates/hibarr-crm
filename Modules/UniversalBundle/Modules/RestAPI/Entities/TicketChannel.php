<?php

namespace Modules\RestAPI\Entities;

use App\Observers\TicketChannelObserver;

class TicketChannel extends \App\Models\TicketChannel
{
    // region Properties

    protected $table = 'ticket_channels';

    protected $fillable = [
        'channel_name',
    ];

    protected $default = [
        'id',
        'channel_name',
    ];

    protected $filterable = [
        'id',
        'channel_name',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TicketChannelObserver::class);
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
