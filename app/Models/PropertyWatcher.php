<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

class PropertyWatcher extends Pivot
{
    const ADDED_VIA_SELF = 'self';
    const ADDED_VIA_MANUAL = 'manual';

    protected $guarded = ['id'];

    protected $table = 'property_watchers';

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class, 'property_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
