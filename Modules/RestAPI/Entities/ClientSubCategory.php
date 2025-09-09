<?php

namespace Modules\RestAPI\Entities;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientSubCategory extends \App\Models\ClientSubCategory
{
    protected $fillable = ['category_name'];

    protected $default = ['id', 'category_name', 'category_id'];

    protected $guarded = ['id', 'category_id'];

    protected $filterable = ['category_name', 'category_id'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(ClientCategory::class, 'category_id');
    }
}
