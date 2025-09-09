<?php

namespace Modules\RestAPI\Entities;

use App\Observers\TicketGroupObserver;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TicketGroup extends \App\Models\TicketGroup
{
    // region Properties

    protected $table = 'ticket_groups';

    protected $fillable = [
        'group_name',
    ];

    protected $default = [
        'id',
        'group_name',
    ];

    protected $filterable = [
        'id',
        'group_name',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TicketGroupObserver::class);
    }

    public function agents(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'ticket_agent_groups',
            'group_id',
            'agent_id'
        )
            ->where('ticket_agent_groups.status', '=', 'enabled');
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
