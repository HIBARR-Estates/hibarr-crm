<?php

namespace App\Models;

use App\Enums\OfferType;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Offer extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'description',
        'type',
        'value',
        'max_discount_amount',
        'is_active',
        'starts_at',
        'ends_at',
        'added_by',
        'last_updated_by',
    ];

    protected $casts = [
        'type' => OfferType::class,
        'value' => 'decimal:2',
        'max_discount_amount' => 'decimal:2',
        'is_active' => 'boolean',
        'starts_at' => 'date',
        'ends_at' => 'date',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function developerProjects(): MorphToMany
    {
        return $this->morphedByMany(DeveloperProject::class, 'offerable');
    }

    public function unitTypes(): MorphToMany
    {
        return $this->morphedByMany(DeveloperProjectUnitType::class, 'offerable');
    }

    public function dealApplications(): HasMany
    {
        return $this->hasMany(DealOfferApplication::class, 'offer_id');
    }

    public function addedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function lastUpdatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_updated_by');
    }

    // ── Scopes ───────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            });
    }

    // ── Helpers ──────────────────────────────────────────────────

    /**
     * Compute the discount for a given amount, respecting max_discount_amount cap.
     */
    public function computeDiscount(float $originalAmount): float
    {
        if ($this->type === OfferType::PERCENTAGE) {
            $discount = $originalAmount * ($this->value / 100);

            if ($this->max_discount_amount !== null) {
                $discount = min($discount, (float) $this->max_discount_amount);
            }

            return round($discount, 2);
        }

        // Fixed discount — cannot exceed original amount
        return round(min((float) $this->value, $originalAmount), 2);
    }

    /**
     * Check if this offer is currently valid (active + within date range).
     */
    public function isCurrentlyValid(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $today = now()->startOfDay();

        if ($this->starts_at && $today->lt($this->starts_at)) {
            return false;
        }

        if ($this->ends_at && $today->gt($this->ends_at)) {
            return false;
        }

        return true;
    }
}
