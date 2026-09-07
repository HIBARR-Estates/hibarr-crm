<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\DealOfferApplication;
use App\Models\DeveloperProjectUnitType;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Property;
use Illuminate\Support\Collection;

class DealPropertyService
{
    public function __construct(
        private DealValueResolver $dealValueResolver,
        private PackagePipelineRouterService $packageRouter,
        private PackageRoutingFieldCatalog $routingFieldCatalog,
        private DealNotificationService $notificationService,
    ) {}

    /**
     * Get all properties attached to a deal (via products), including applied offer applications.
     */
    public function getAttachedProperties(Deal $deal): Collection
    {
        $products = $deal->products()
            ->with([
                'property' => function ($q) {
                    $q->select(
                        'id', 'product_id', 'developer_project_id', 'developer_project_unit_type_id',
                        'title', 'property_type', 'sale_type', 'price', 'bedrooms', 'bathrooms',
                        'city', 'area', 'land_size', 'status', 'photos', 'view_types',
                        'floor_number', 'living_area_sqm', 'outside_features', 'inside_features'
                    );
                },
                'property.developerProject' => function ($q) {
                    $q->select('id', 'name', 'availability_link');
                },
            ])
            ->get();

        $productIds = $products->pluck('id');
        $offerApps = DealOfferApplication::where('deal_id', $deal->id)
            ->whereIn('product_id', $productIds)
            ->with(['offer:id,name,type,value,max_discount_amount,ends_at'])
            ->get()
            ->groupBy('product_id');

        return $products->map(function ($product) use ($offerApps) {
            return [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'property' => $product->property ? array_merge(
                    $product->property->toArray(),
                    ['developer_project' => $product->property->developerProject?->toArray()]
                ) : null,
                'offer_applications' => ($offerApps[$product->id] ?? collect())->values()->toArray(),
            ];
        });
    }

    /**
     * Attach an existing approved property to a deal.
     */
    public function attachExistingProperty(Deal $deal, int $propertyId): array
    {
        if ($deal->isCommissionLocked()) {
            return ['status' => 'fail', 'message' => __('messages.dealValueLockedByCommission')];
        }

        $property = Property::where('id', $propertyId)
            ->where('company_id', $deal->company_id)
            ->firstOrFail();

        // Find or create a Product linked to this property
        $product = $this->findOrCreateProductForProperty($property);

        // Prevent duplicate attachment
        if ($deal->products()->where('products.id', $product->id)->exists()) {
            return ['status' => 'fail', 'message' => 'Property is already attached to this deal.'];
        }

        $deal->products()->attach($product->id);
        app(DealActivityEventService::class)->recordProductLinked($deal, $product, $property);
        $this->notificationService->notifyPropertyLinked(
            $deal,
            $this->propertyLabel($property, $product),
            $property->id,
        );
        $deal = $deal->fresh(['products', 'packages', 'company']);
        $this->dealValueResolver->resolveAndPersist($deal);
        $this->packageRouter->attemptRoutingFromDealState(
            $deal,
            $this->routingFieldCatalog->enabledRelationBackedFieldKeys($deal->company_id),
        );

        return ['status' => 'success', 'message' => 'Property attached successfully.'];
    }

    /**
     * Detach a product (and its property) from a deal.
     * Cleans up any applied offer applications and recalculates deal value.
     */
    public function detachProperty(Deal $deal, int $productId): array
    {
        if ($deal->isCommissionLocked()) {
            return ['status' => 'fail', 'message' => __('messages.dealValueLockedByCommission')];
        }

        $product = Product::with('property')->find($productId);

        DealOfferApplication::where('deal_id', $deal->id)
            ->where('product_id', $productId)
            ->delete();

        $oldPropertyIds = $deal->products()->pluck('products.id')->toArray();
        $oldPropertyNames = $deal->products()->pluck('products.name', 'products.id')->toArray();

        $deal->products()->detach($productId);

        $newPropertyIds = $deal->products()->pluck('products.id')->toArray();
        $newPropertyNames = $deal->products()->pluck('products.name', 'products.id')->toArray();

        app(DealActivityEventService::class)->recordPropertyUnlinked(
            $deal,
            $oldPropertyIds,
            $newPropertyIds,
            $oldPropertyNames,
            $newPropertyNames
        );

        if ($product?->property) {
            $this->notificationService->notifyPropertyUnlinked(
                $deal,
                $this->propertyLabel($product->property, $product),
                (int) $product->property->id,
            );
        }

        $this->dealValueResolver->resolveAndPersist($deal);

        return ['status' => 'success', 'message' => 'Property detached successfully.'];
    }

    /**
     * Create a new Property from a DeveloperProjectUnitType, with field overrides,
     * then attach it to the deal. Applies selected offers immediately.
     *
     * @param  array  $offerIds  IDs of active offers the agent has selected for this property.
     */
    public function createFromUnitType(Deal $deal, int $unitTypeId, array $overrides, array $offerIds = []): array
    {
        if ($deal->isCommissionLocked()) {
            return ['status' => 'fail', 'message' => __('messages.dealValueLockedByCommission')];
        }

        $unitType = DeveloperProjectUnitType::where('id', $unitTypeId)
            ->where('company_id', $deal->company_id)
            ->firstOrFail();

        $propertyTitle = $unitType->reference_code
            ? "{$unitType->property_type} - {$unitType->reference_code}"
            : $unitType->property_type;

        $propertyPrice = $overrides['price'] ?? $unitType->starting_price;

        // Create Product FIRST so we have a valid product_id for the FK constraint
        $product = Product::create([
            'company_id' => $deal->company_id,
            'name' => $propertyTitle ?? 'Property',
            'price' => is_array($propertyPrice) ? ($propertyPrice['amount'] ?? 0) : $propertyPrice,
        ]);

        $property = Property::create([
            'company_id' => $deal->company_id,
            'product_id' => $product->id,
            'developer_project_id' => $unitType->developer_project_id,
            'developer_project_unit_type_id' => $unitType->id,
            'property_type' => $unitType->property_type,
            'primary_category' => $unitType->primary_category,
            'unit_style' => $unitType->unit_style,
            'bedrooms' => $unitType->bedrooms,
            'bathrooms' => $unitType->bathrooms,
            'living_area_sqm' => $unitType->living_area_sqm,
            'total_area_sqm' => $unitType->total_area_sqm,
            'terrace_area_sqm' => $unitType->terrace_balcony_sqm,
            'plot_size_sqm' => $unitType->plot_size_sqm,
            'floors_in_building' => $unitType->floors_in_building,
            'outside_features' => $overrides['outside_features'] ?? $unitType->outside_features,
            'inside_features' => $overrides['inside_features'] ?? $unitType->inside_features,
            'completion_date' => $unitType->completion_date,
            'has_restrictions' => $unitType->has_restrictions,
            'restriction_notes' => $unitType->restriction_notes,
            'description' => $unitType->description,
            'title' => $propertyTitle,
            'status' => Property::STATUS_AVAILABLE,
            'added_by' => user()->id,
            'responsible_agent_id' => user()->id,
            'price' => $propertyPrice,
            'floor_number' => $overrides['floor_number'] ?? $unitType->floor,
            'view_types' => $overrides['view_types'] ?? $unitType->view_types,
        ]);

        $deal->products()->attach($product->id);
        app(DealActivityEventService::class)->recordProductLinked($deal, $product, $property);
        $this->notificationService->notifyPropertyLinked(
            $deal,
            $this->propertyLabel($property, $product),
            $property->id,
        );

        // Apply selected offers immediately
        if (! empty($offerIds)) {
            $validOfferIds = $unitType->activeOffers()
                ->whereIn('offers.id', $offerIds)
                ->pluck('offers.id');

            $originalAmount = (float) ($product->price ?? 0);

            foreach ($validOfferIds as $offerId) {
                $offer = Offer::find($offerId);
                if (! $offer) {
                    continue;
                }

                DealOfferApplication::create([
                    'deal_id' => $deal->id,
                    'offer_id' => $offerId,
                    'product_id' => $product->id,
                    'resolved_from_type' => DeveloperProjectUnitType::class,
                    'resolved_from_id' => $unitType->id,
                    'original_amount' => $originalAmount,
                    'discount_amount' => $offer->computeDiscount($originalAmount),
                    'offer_type' => $offer->type->value,
                    'offer_value' => $offer->value,
                ]);
            }
        }

        $this->dealValueResolver->resolveAndPersist($deal->fresh());
        $deal = $deal->fresh(['products', 'packages', 'company']);
        $this->packageRouter->attemptRoutingFromDealState(
            $deal,
            $this->routingFieldCatalog->enabledRelationBackedFieldKeys($deal->company_id),
        );

        return ['status' => 'success', 'message' => 'Property created and attached successfully.'];
    }

    /**
     * Search approved/published properties.
     */
    public function searchProperties(string $query, int $companyId): Collection
    {
        return Property::where('company_id', $companyId)
            ->where('is_published', true)
            ->where(function ($q) use ($query) {
                $q->where('title', 'like', "%{$query}%")
                    ->orWhere('city', 'like', "%{$query}%")
                    ->orWhere('area', 'like', "%{$query}%")
                    ->orWhere('property_type', 'like', "%{$query}%");
            })
            ->select('id', 'title', 'property_type', 'sale_type', 'price', 'city', 'area', 'status', 'photos', 'bedrooms', 'bathrooms')
            ->limit(20)
            ->get();
    }

    /**
     * Get unit types for a project, including their currently active offers.
     */
    public function getProjectUnitTypes(int $projectId, int $companyId): Collection
    {
        return DeveloperProjectUnitType::where('developer_project_id', $projectId)
            ->where('company_id', $companyId)
            ->select(
                'id', 'developer_project_id', 'reference_code', 'primary_category',
                'property_type', 'quantity', 'unit_style', 'view_types', 'furniture_status',
                'starting_price', 'currency', 'bedrooms', 'bathrooms', 'floor',
                'floors_in_building', 'total_area_sqm', 'living_area_sqm',
                'terrace_balcony_sqm', 'plot_size_sqm', 'outside_features', 'inside_features',
                'description'
            )
            ->with(['activeOffers:id,name,type,value,max_discount_amount,ends_at'])
            ->orderBy('order')
            ->get();
    }

    /**
     * Find or create a Product record for a property.
     */
    private function findOrCreateProductForProperty(Property $property): Product
    {
        if ($property->product_id) {
            $product = Product::find($property->product_id);
            if ($product) {
                return $product;
            }
        }

        $product = Product::create([
            'company_id' => $property->company_id,
            'name' => $property->title ?? 'Property #'.$property->id,
            'price' => is_array($property->price) ? ($property->price['amount'] ?? 0) : $property->price,
        ]);

        $property->update(['product_id' => $product->id]);

        return $product;
    }

    private function propertyLabel(?Property $property, Product $product): string
    {
        $label = trim((string) ($property?->title ?? $property?->reference_code ?? $product->name ?? ''));

        return $label !== '' ? $label : 'Property';
    }
}
