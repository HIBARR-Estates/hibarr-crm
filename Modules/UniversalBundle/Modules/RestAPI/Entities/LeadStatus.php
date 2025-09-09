<?php

namespace Modules\RestAPI\Entities;

use App\Observers\LeadStatusObserver;

class LeadStatus extends \App\Models\LeadStatus
{
    protected $fillable = ['type', 'priority', 'default', 'label_color'];

    protected $default = ['id', 'type', 'priority', 'default', 'label_color'];

    protected $guarded = ['id'];

    protected $filterable = ['type', 'priority', 'default', 'label_color'];

    public static function boot()
    {
        parent::boot();
        static::observe(LeadStatusObserver::class);
    }
}
