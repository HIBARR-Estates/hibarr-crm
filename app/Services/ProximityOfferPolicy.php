<?php

namespace App\Services;

use App\Contracts\OfferPolicyContract;
use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use Illuminate\Support\Collection;

/**
 * Offer resolution policy: unit type is the sole primary entry point.
 *
 * Resolution order:
 *   1. All active UnitType-level offers for the property's unit type.
 *   2. Empty collection — no offers apply.
 *
 * Project-level offerables rows are used only as "broadcast markers" in the UI
 * and are never resolved here. This makes unit types the unambiguous first-class
 * citizens for offer application, and removes any fallback ambiguity.
 */
class ProximityOfferPolicy implements OfferPolicyContract
{
    public function resolve(Property $property): Collection
    {
        if ($property->developer_project_unit_type_id) {
            $unitType = $property->unitType;

            if ($unitType) {
                $offers = $unitType->activeOffers()->get();

                if ($offers->isNotEmpty()) {
                    return $offers->map(fn ($offer) => [
                        'offer' => $offer,
                        'resolved_from_type' => DeveloperProjectUnitType::class,
                        'resolved_from_id' => $unitType->id,
                    ]);
                }
            }
        }

        return collect();
    }
}
