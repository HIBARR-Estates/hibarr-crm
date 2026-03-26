<?php

namespace App\Services;

use App\Contracts\OfferPolicyContract;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Offer;
use App\Models\Property;

/**
 * Default offer resolution policy: closest proximity wins.
 *
 * Resolution order:
 *   1. UnitType active offer (closest to the property)
 *   2. Project active offer (parent of the unit type)
 *   3. null — no offer applies
 *
 * Only one active offer per model is allowed, enforced at attach time.
 */
class ProximityOfferPolicy implements OfferPolicyContract
{
    public function resolve(Property $property): ?array
    {
        // 1. Check unit type offer (closest proximity)
        if ($property->developer_project_unit_type_id) {
            $unitType = $property->unitType;

            if ($unitType) {
                $offer = $unitType->activeOffer();

                if ($offer) {
                    return [
                        'offer' => $offer,
                        'resolved_from_type' => DeveloperProjectUnitType::class,
                        'resolved_from_id' => $unitType->id,
                    ];
                }

                // 2. Fall back to project offer via unit type
                $project = $unitType->project;

                if ($project) {
                    $offer = $project->activeOffer();

                    if ($offer) {
                        return [
                            'offer' => $offer,
                            'resolved_from_type' => DeveloperProject::class,
                            'resolved_from_id' => $project->id,
                        ];
                    }
                }
            }
        }

        // 3. Check project offer directly (property may belong to project without unit type)
        if ($property->developer_project_id) {
            $project = $property->developerProject;

            if ($project) {
                $offer = $project->activeOffer();

                if ($offer) {
                    return [
                        'offer' => $offer,
                        'resolved_from_type' => DeveloperProject::class,
                        'resolved_from_id' => $project->id,
                    ];
                }
            }
        }

        return null;
    }
}
