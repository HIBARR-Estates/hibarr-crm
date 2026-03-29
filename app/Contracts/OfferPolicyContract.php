<?php

namespace App\Contracts;

use App\Models\Property;
use Illuminate\Support\Collection;

interface OfferPolicyContract
{
    /**
     * Resolve which offers apply to a given property.
     * Proximity: UnitType-level offers win over Project-level.
     *
     * @return Collection<int, array{offer: \App\Models\Offer, resolved_from_type: string, resolved_from_id: int}>
     */
    public function resolve(Property $property): Collection;
}
