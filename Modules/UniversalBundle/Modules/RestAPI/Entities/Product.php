<?php

namespace Modules\RestAPI\Entities;

use App\Observers\ProductObserver;

class Product extends \App\Models\Product
{
    // region Properties

    protected $table = 'products';

    protected $default = [
        'id',
        'name',
        'description',
        'price',
        'taxes',
    ];

    protected $filterable = [
        'id',
        'name',
        'description',
        'price',
        'taxes',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(ProductObserver::class);
    }
}
