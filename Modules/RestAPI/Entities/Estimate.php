<?php

namespace Modules\RestAPI\Entities;

use App\Observers\EstimateObserver;

class Estimate extends \App\Models\Estimate
{
    // region Properties

    protected $table = 'estimates';

    protected $hidden = [
        'updated_at',
    ];

    protected $default = [
        'id',
        'estimate_number',
        'total',
        'status',
        'valid_till',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'status',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(EstimateObserver::class);
    }

    public function visibleTo(\App\Models\User $user)
    {
        if ($user->hasRole('admin') || ($user->hasRole('employee') || $user->cans('view_estimates'))) {
            return true;
        }

        return $this->client_id == $user->id;
    }

    public function scopeVisibility($query)
    {
        if (api_user()) {
            $user = api_user();

            if ($user->hasRole('client')) {
                $query->where('estimates.client_id', $user->id);
            }

            return $query;
        }
    }
}
