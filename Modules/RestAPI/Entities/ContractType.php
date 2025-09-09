<?php

namespace Modules\RestAPI\Entities;

use App\Observers\ContractTypeObserver;

class ContractType extends \App\Models\ContractType
{
    // region Properties

    protected $table = 'contract_types';

    protected $default = [
        'id',
        'name',
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'name',
    ];

    //endregion

    //region Boot
    public static function boot()
    {
        parent::boot();
        static::observe(ContractTypeObserver::class);
    }
}
