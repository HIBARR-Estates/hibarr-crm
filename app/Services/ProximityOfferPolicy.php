<?php

namespace App\Services;

use App\Contracts\OfferPolicyContract;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use Illuminate\Support\Collection;

/**
 * Default offer resolution policy: closest proximity wins.
 *
 * Resolution order:
 *   1. All active UnitType offers (closest to the property)
 *   2. All active Project offers (parent of the unit type / direct project)
 *   3. Empty collection — no offers apply
 *
 * Multiple offers per level are allowed. Each applies independently.
 */
class ProximityOfferPolicy implements OfferPolicyContract
{
    public function resolve(Property $property): Collection
    {
        // 1. Check unit type offers (closest proximity)
        if ($property->developer_project_unit_type_id) {
            $unitType = $property->unitType;

            if ($unitType) {
                $unitTypeOffers = $unitType->activeOffers()->get();

                if ($unitTypeOffers->isNotEmpty()) {
                    return $unitTypeOffers->map(fn ($offer) => [
                        'offer' => $offer,
                        'resolved_from_type' => DeveloperProjectUnitType::class,
                        'resolved_from_id' => $unitType->id,
                    ]);
                }

                // 2. Fall back to project offers via unit type
                $project = $unitType->project;

                if ($project) {
                    $projectOffers = $project->activeOffers()->get();

                    if ($projectOffers->isNotEmpty()) {
                        return $projectOffers->map(fn ($offer) => [
                            'offer' => $offer,
                            'resolved_from_type' => DeveloperProject::class,
                            'resolved_from_id' => $project->id,
                        ]);
                    }
                }
            }
        }

        // 3. Check project offers directly (property may belong to project without unit type)
        if ($property->developer_project_id) {
            $project = $property->developerProject;

            if ($project) {
                $projectOffers = $project->activeOffers()->get();

                if ($projectOffers->isNotEmpty()) {
                    return $projectOffers->map(fn ($offer) => [
                        'offer' => $offer,
                        'resolved_from_type' => DeveloperProject::class,
                        'resolved_from_id' => $project->id,
                    ]);
                }
            }
        }

        return collect();
    }
}
