<?php

namespace Modules\RestAPI\Entities;

use App\Observers\ContractObserver;

class Contract extends \App\Models\Contract
{
    // region Properties

    protected $table = 'contracts';

    protected $default = [
        'id',
        'subject',
        'amount',
        'start_date',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'subject',
        'amount',
        'start_date',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(ContractObserver::class);
    }
}
