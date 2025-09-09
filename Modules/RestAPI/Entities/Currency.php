<?php

namespace Modules\RestAPI\Entities;

use App\Observers\CurrencyObserver;

class Currency extends \App\Models\Currency
{
    // region Properties

    protected $table = 'currencies';

    protected $default = [
        'id',
        'company_id',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(CurrencyObserver::class);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }
}
