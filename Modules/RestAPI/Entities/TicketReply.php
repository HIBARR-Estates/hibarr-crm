<?php

namespace Modules\RestAPI\Entities;

use App\Observers\TicketReplyObserver;

class TicketReply extends \App\Models\TicketReply
{
    // region Properties

    protected $table = 'ticket_replies';

    protected $hidden = [
        'updated_at',
    ];

    protected $fillable = [
        'ticket_id',
        'user_id',
        'message',
    ];

    protected $default = [
        'id',
        'message',
        'created_at',
    ];

    protected $filterable = [
        'id',
        'message',
        'ticket_id',
        'user_id',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TicketReplyObserver::class);
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
