<?php

namespace Modules\RestAPI\Entities;

use App\Observers\DesignationObserver;

class Designation extends \App\Models\Designation
{
    protected $table = 'designations';

    protected $default = [
        'id',
        'name',
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
        static::observe(DesignationObserver::class);
    }
}
