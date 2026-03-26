<?php

namespace App\Contracts;

use App\Models\Offer;
use App\Models\Property;

interface OfferPolicyContract
{
    /**
     * Resolve which offer (if any) applies to a given property.
     *
     * @return array{offer: Offer, resolved_from_type: string, resolved_from_id: int}|null
     */
    public function resolve(Property $property): ?array;
}
