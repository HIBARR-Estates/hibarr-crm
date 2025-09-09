<?php

namespace Modules\RestAPI\Entities;

use App\Observers\HolidayObserver;

class Holiday extends \App\Models\Holiday
{
    // region Properties

    protected $table = 'holidays';

    protected $dates = ['date'];

    protected $default = [
        'id',
        'date',
        'occassion',
    ];

    protected $filterable = [
        'id',
        'date',
        'occassion',
    ];

    //endregion

    public static function boot()
    {
        parent::boot();
        static::observe(HolidayObserver::class);
    }
}
