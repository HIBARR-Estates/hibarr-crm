<?php

namespace App\Models;

use App\Enums\OfferType;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class DealOfferApplication extends BaseModel
{
    protected $fillable = [
        'deal_id',
        'offer_id',
        'product_id',
        'resolved_from_type',
        'resolved_from_id',
        'original_amount',
        'discount_amount',
        'offer_type',
        'offer_value',
    ];

    protected $casts = [
        'offer_type' => OfferType::class,
        'original_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'offer_value' => 'decimal:2',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * The model (DeveloperProject or DeveloperProjectUnitType) the offer was resolved from.
     */
    public function resolvedFrom(): MorphTo
    {
        return $this->morphTo('resolved_from');
    }
}
