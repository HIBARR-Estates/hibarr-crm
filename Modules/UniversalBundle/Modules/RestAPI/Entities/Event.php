<?php

namespace Modules\RestAPI\Entities;

use App\Models\User;
use App\Observers\EventObserver;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Event extends \App\Models\Event
{
    // region Properties

    protected $table = 'events';

    protected $dates = ['date'];

    public function attendees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'event_attendees');
    }

    protected $default = [
        'id',
    ];

    protected $hidden = [
        'company_id',
    ];

    protected $guarded = [
        'id',
        'company_id',
    ];

    protected $filterable = [
        'id',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(EventObserver::class);
    }
}
