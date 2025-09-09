<?php

namespace Modules\RestAPI\Entities;

use App\Observers\TicketObserver;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Ticket extends \App\Models\Ticket
{
    // region Properties

    protected $table = 'tickets';

    protected $fillable = [
        'user_id',
        'subject',
        'status',
        'priority',
        'agent_id',
        'channel_id',
        'type_id',
    ];

    protected $default = [
        'id',
        'subject',
        'status',
        'priority',
    ];

    protected $hidden = [
        'agent_id',
        'user_id',
    ];

    protected $dates = [
        'deleted_at',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'subject',
        'status',
        'agent_id',
        'user_id',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TicketObserver::class);
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(TicketType::class, 'type_id');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(TicketChannel::class, 'channel_id');
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
            $user = api_user();

            if ($user->hasRole('admin')) {
                return $query;
            }

            if ($user->hasRole('employee')) {
                $query->where('agent_id', $user->id);

                return $query;
            }

            if ($user->hasRole('client')) {
                $query->where('user_id', $user->id);

                return $query;
            }

            return $query;
        }
    }
}
