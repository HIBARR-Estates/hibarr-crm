<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadUtmTouch extends BaseModel
{
    protected $table = 'lead_utm_touches';

    public const UTM_FIELDS = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_content',
        'utm_term',
        'utm_audience',
    ];

    protected $fillable = [
        'lead_id',
        ...self::UTM_FIELDS,
        'origin',
        'is_first_touch',
    ];

    protected $casts = [
        'is_first_touch' => 'boolean',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }
}
