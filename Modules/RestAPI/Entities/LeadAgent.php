<?php

namespace Modules\RestAPI\Entities;

use App\Observers\LeadAgentObserver;

class LeadAgent extends \App\Models\LeadAgent
{
    protected $fillable = ['user_id'];

    protected $default = ['id', 'user_id'];

    protected $guarded = ['id'];

    protected $filterable = ['user_id'];

    public static function boot()
    {
        parent::boot();
        static::observe(LeadAgentObserver::class);
    }
}
