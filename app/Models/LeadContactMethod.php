<?php

namespace App\Models;

use App\Enums\LeadContactMethodType;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadContactMethod extends BaseModel
{
    protected $table = 'lead_contact_methods';

    protected $fillable = [
        'lead_id',
        'company_id',
        'type',
        'identifier',
        'normalized',
        'is_main',
        'source_field',
    ];

    protected $casts = [
        'type' => LeadContactMethodType::class,
        'is_main' => 'boolean',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }
}
