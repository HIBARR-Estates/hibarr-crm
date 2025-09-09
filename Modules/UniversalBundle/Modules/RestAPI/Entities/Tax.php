<?php

namespace Modules\RestAPI\Entities;

use App\Observers\TaxObserver;

class Tax extends \App\Models\Tax
{
    // region Properties

    protected $table = 'taxes';

    protected $default = [
        'id',
        'tax_name',
        'rate_percent',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'tax_name',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TaxObserver::class);
    }

    public function visibleTo(\App\Models\User $user)
    {
        if ($user) {
            return true;
        }

        return false;
    }

    public function scopeVisibility($query)
    {
        return $query;
    }
}
