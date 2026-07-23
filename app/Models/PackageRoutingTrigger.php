<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PackageRoutingTrigger extends BaseModel
{
    use HasCompany;

    protected $fillable = [
        'company_id',
        'package_id',
        'field_key',
        'match_mode',
        'match_value',
    ];

    public function package(): BelongsTo
    {
        return $this->belongsTo(Package::class);
    }
}
