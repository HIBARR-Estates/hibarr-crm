<?php

namespace App\Services;

use App\Contracts\OfferPolicyContract;
use App\Models\Deal;
use App\Models\DealOfferApplication;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class DealOfferService
{
    public function __construct(
        private OfferPolicyContract $policy,
    ) {}

    /**
     * Apply offers to a deal based on its products' properties.
     * Removes previously applied offers and recalculates from scratch.
     * Multiple offers may apply per product (each independently, no compounding).
     */
    public function applyOffersToDeal(Deal $deal): Collection
    {
        // Clear existing applications for this deal
        $deal->offerApplications()->delete();

        $applications = collect();

        // Load products with their properties and the full hierarchy
        $products = $deal->products()
            ->whereHas('property')
            ->with([
                'property.unitType.offers' => fn ($q) => $q->active()->wherePivot('is_active', true),
                'property.unitType.project.offers' => fn ($q) => $q->active()->wherePivot('is_active', true),
                'property.developerProject.offers' => fn ($q) => $q->active()->wherePivot('is_active', true),
            ])
            ->get();

        foreach ($products as $product) {
            $property = $product->property;

            if (!$property) {
                continue;
            }

            $resolved = $this->policy->resolve($property);

            if ($resolved->isEmpty()) {
                continue;
            }

            $originalAmount = (float) ($product->price ?? 0);

            if ($originalAmount <= 0) {
                continue;
            }

            foreach ($resolved as $entry) {
                $offer = $entry['offer'];
                $discountAmount = $offer->computeDiscount($originalAmount);

                if ($discountAmount <= 0) {
                    continue;
                }

                $application = DealOfferApplication::create([
                    'deal_id' => $deal->id,
                    'offer_id' => $offer->id,
                    'product_id' => $product->id,
                    'resolved_from_type' => $entry['resolved_from_type'],
                    'resolved_from_id' => $entry['resolved_from_id'],
                    'original_amount' => $originalAmount,
                    'discount_amount' => $discountAmount,
                    'offer_type' => $offer->type->value,
                    'offer_value' => $offer->value,
                ]);

                $applications->push($application);
            }
        }

        Log::info('DealOfferService: Applied offers to deal', [
            'deal_id' => $deal->id,
            'applications_count' => $applications->count(),
        ]);

        return $applications;
    }

    /**
     * Remove all offer applications from a deal.
     */
    public function removeOffersFromDeal(Deal $deal): void
    {
        $deal->offerApplications()->delete();

        Log::info('DealOfferService: Removed all offers from deal', [
            'deal_id' => $deal->id,
        ]);
    }

    /**
     * Preview what offers would apply to a deal without persisting.
     *
     * @return Collection<int, array{product_id: int, offer: \App\Models\Offer, resolved_from_type: string, resolved_from_id: int, original_amount: float, discount_amount: float}>
     */
    public function previewOffers(Deal $deal): Collection
    {
        $previews = collect();

        $products = $deal->products()
            ->whereHas('property')
            ->with([
                'property.unitType.offers' => fn ($q) => $q->active()->wherePivot('is_active', true),
                'property.unitType.project.offers' => fn ($q) => $q->active()->wherePivot('is_active', true),
                'property.developerProject.offers' => fn ($q) => $q->active()->wherePivot('is_active', true),
            ])
            ->get();

        foreach ($products as $product) {
            $property = $product->property;

            if (!$property) {
                continue;
            }

            $resolved = $this->policy->resolve($property);

            if ($resolved->isEmpty()) {
                continue;
            }

            $originalAmount = (float) ($product->price ?? 0);

            if ($originalAmount <= 0) {
                continue;
            }

            foreach ($resolved as $entry) {
                $offer = $entry['offer'];
                $discountAmount = $offer->computeDiscount($originalAmount);

                if ($discountAmount <= 0) {
                    continue;
                }

                $previews->push([
                    'product_id' => $product->id,
                    'offer' => $offer,
                    'resolved_from_type' => $entry['resolved_from_type'],
                    'resolved_from_id' => $entry['resolved_from_id'],
                    'original_amount' => $originalAmount,
                    'discount_amount' => $discountAmount,
                ]);
            }
        }

        return $previews;
    }

    /**
     * Get total discount for a deal from applied offers.
     */
    public function getDealDiscount(Deal $deal): float
    {
        return (float) $deal->offerApplications()->sum('discount_amount');
    }
}
