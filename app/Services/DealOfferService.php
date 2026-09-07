<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\DealOfferApplication;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use Illuminate\Support\Facades\Log;

class DealOfferService
{
    public function __construct(
        private DealValueResolver $dealValueResolver,
    ) {}

    /**
     * Auto-apply all currently active offers for the deal's linked properties.
     *
     * The method is idempotent: existing applications are rebuilt from scratch
     * to ensure stale offers are removed when attachments or validity change.
     */
    public function applyOffersToDeal(Deal $deal): void
    {
        if ($deal->isCommissionLocked()) {
            return;
        }

        $deal->loadMissing([
            'products.property.developerProject',
            'products.property.developerProjectUnitType',
        ]);

        $applications = [];

        foreach ($deal->products as $product) {
            $property = $product->property;

            if (!$property) {
                continue;
            }

            $resolvedOffers = [];

            // Unit type offers have higher priority than project-level offers. 
            // Simply apply just developer project unit type offers for now, as dictated by current business rules. We can re-introduce project-level offers in the future if needed, but it adds complexity to offer application and potential conflicts when both unit type and project offers are active.
            if ($property->developerProjectUnitType) {
                foreach ($property->developerProjectUnitType->activeOffers()->get() as $offer) {
                    $resolvedOffers[$offer->id] = [
                        'offer' => $offer,
                        'resolved_from_type' => DeveloperProjectUnitType::class,
                        'resolved_from_id' => $property->developer_project_unit_type_id,
                    ];
                }
            }

            // if ($property->developerProject) {
            //     foreach ($property->developerProject->activeOffers()->get() as $offer) {
            //         if (!isset($resolvedOffers[$offer->id])) {
            //             $resolvedOffers[$offer->id] = [
            //                 'offer' => $offer,
            //                 'resolved_from_type' => DeveloperProject::class,
            //                 'resolved_from_id' => $property->developer_project_id,
            //             ];
            //         }
            //     }
            // }

            $originalAmount = (float) ($product->price ?? 0);

            foreach ($resolvedOffers as $resolvedOffer) {
                $offer = $resolvedOffer['offer'];

                $applications[] = [
                    'deal_id' => $deal->id,
                    'offer_id' => $offer->id,
                    'product_id' => $product->id,
                    'resolved_from_type' => $resolvedOffer['resolved_from_type'],
                    'resolved_from_id' => $resolvedOffer['resolved_from_id'],
                    'original_amount' => $originalAmount,
                    'discount_amount' => $offer->computeDiscount($originalAmount),
                    'offer_type' => $offer->type->value,
                    'offer_value' => $offer->value,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        $deal->offerApplications()->delete();

        if (!empty($applications)) {
            DealOfferApplication::insert($applications);
        }

        Log::info('DealOfferService: Applied offers to deal', [
            'deal_id' => $deal->id,
            'applications_count' => count($applications),
        ]);

        $this->dealValueResolver->resolveAndPersist($deal);
    }


    /**
     * Remove all offer applications from a deal.
     */
    public function removeOffersFromDeal(Deal $deal): void
    {
        if ($deal->isCommissionLocked()) {
            return;
        }

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
