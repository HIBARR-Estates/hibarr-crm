<?php

namespace Modules\RestAPI\Entities;

use App\Observers\LeadSourceObserver;

class LeadSource extends \App\Models\LeadSource
{
    protected $fillable = ['type'];

    protected $default = ['id', 'type'];

    protected $filterable = ['type'];

    public static function boot()
    {
        parent::boot();
        static::observe(LeadSourceObserver::class);
    }
}
