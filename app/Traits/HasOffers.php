<?php

namespace App\Traits;

use App\Models\Offer;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

trait HasOffers
{
    public function offers(): MorphToMany
    {
        return $this->morphToMany(Offer::class, 'offerable');
    }

    public function activeOffers(): MorphToMany
    {
        return $this->offers()->active();
    }

    /**
     * Get the single active offer for this model (only one allowed).
     */
    public function activeOffer(): ?Offer
    {
        return $this->activeOffers()->first();
    }

    /**
     * Check if this model already has an active offer attached.
     */
    public function hasActiveOffer(): bool
    {
        return $this->activeOffers()->exists();
    }
}
