<?php

namespace Modules\RestAPI\Entities;

use App\Observers\ClientCategoryObserver;

class ClientCategory extends \App\Models\ClientCategory
{
    protected $fillable = ['category_name'];

    protected $default = ['id', 'category_name'];

    protected $guarded = ['id'];

    protected $filterable = ['category_name'];

    public static function boot()
    {
        parent::boot();
        static::observe(ClientCategoryObserver::class);
    }
}
