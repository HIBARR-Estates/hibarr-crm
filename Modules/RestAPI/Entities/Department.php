<?php

namespace Modules\RestAPI\Entities;

use App\Models\Team;
use App\Observers\TeamObserver;

class Department extends Team
{
    protected $table = 'teams';

    protected $default = [
        'id',
        'team_name',
    ];

    protected $guarded = [
        'id',
        'created_at',
        'updated_at',
    ];

    protected $filterable = [
        'id',
        'team_name',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TeamObserver::class);
    }
}
