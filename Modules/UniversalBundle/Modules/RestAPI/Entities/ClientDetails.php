<?php

namespace Modules\RestAPI\Entities;

use App\Observers\ClientDetailsObserver;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientDetails extends \App\Models\ClientDetails
{
    protected $default = [
        'id',
        'company_id',
    ];

    protected $hidden = [
        'user_id',
    ];

    protected $guarded = [
        'id',
        'category_id',
        'sub_category_id',
    ];

    protected $filterable = [
        'id',
        'company_name',
        'category_id',
        'sub_category_id',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(ClientDetailsObserver::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ClientCategory::class, 'category_id');
    }

    public function subCategory(): BelongsTo
    {
        return $this->belongsTo(ClientSubCategory::class, 'sub_category_id');
    }
}
