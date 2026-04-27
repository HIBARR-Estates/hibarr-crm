<?php

namespace App\Services;

use App\Models\Deal;
use Illuminate\Support\Facades\Log;

class DealOfferService
{
    public function __construct(
        private DealValueResolver $dealValueResolver,
    ) {}


    /**
     * Remove all offer applications from a deal.
     */
    public function removeOffersFromDeal(Deal $deal): void
    {
        $deal->offerApplications()->delete();

        Log::info('DealOfferService: Removed all offers from deal', [
            'deal_id' => $deal->id,
        ]);

        $this->dealValueResolver->resolveAndPersist($deal);
    }

    /**
     * Get total discount for a deal from applied offers.
     */
    public function getDealDiscount(Deal $deal): float
    {
        return (float) $deal->offerApplications()->sum('discount_amount');
    }
}
