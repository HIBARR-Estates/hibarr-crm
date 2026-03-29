<?php

namespace App\Traits;

use App\Models\Offer;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

trait HasOffers
{
    public function offers(): MorphToMany
    {
        return $this->morphToMany(Offer::class, 'offerable')
            ->withPivot('is_active', 'disabled_at', 'disabled_by')
            ->withTimestamps();
    }

    /**
     * Get offers that are both globally active and enabled on this pivot.
     */
    public function activeOffers(): MorphToMany
    {
        return $this->offers()
            ->active()
            ->wherePivot('is_active', true);
    }

    /**
     * Get offers enabled on this pivot (regardless of global active status).
     */
    public function enabledOffers(): MorphToMany
    {
        return $this->offers()->wherePivot('is_active', true);
    }

    /**
     * Get offers disabled on this pivot.
     */
    public function disabledOffers(): MorphToMany
    {
        return $this->offers()->wherePivot('is_active', false);
    }
}
