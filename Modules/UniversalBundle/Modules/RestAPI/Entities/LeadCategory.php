<?php

namespace Modules\RestAPI\Entities;

use App\Observers\LeadCategoryObserver;

class LeadCategory extends \App\Models\LeadCategory
{
    protected $fillable = ['category_name'];

    protected $default = ['id', 'category_name'];

    protected $guarded = ['id'];

    protected $filterable = ['category_name'];

    public static function boot()
    {
        parent::boot();
        static::observe(LeadCategoryObserver::class);
    }
}
