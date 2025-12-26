<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomFieldVisibility extends BaseModel
{
    protected $guarded = ['id'];

    public function customField(): BelongsTo
    {
        return $this->belongsTo(CustomField::class, 'custom_field_id');
    }
}
