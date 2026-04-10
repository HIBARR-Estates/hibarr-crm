<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Product;
use App\Models\Property;
use Illuminate\Support\Collection;

class DealPropertyService
{
    /**
     * Get all properties attached to a deal (via products).
     */
    public function getAttachedProperties(Deal $deal): Collection
    {
        return $deal->products()
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
            ->get()
            ->map(function ($product) {
                return [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'property' => $product->property ? array_merge(
                        $product->property->toArray(),
                        ['developer_project' => $product->property->developerProject?->toArray()]
                    ) : null,
                ];
            });
    }

    /**
     * Attach an existing approved property to a deal.
     */
    public function attachExistingProperty(Deal $deal, int $propertyId): array
    {
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

        return ['status' => 'success', 'message' => 'Property attached successfully.'];
    }

    /**
     * Detach a product (and its property) from a deal.
     */
    public function detachProperty(Deal $deal, int $productId): array
    {
        $deal->products()->detach($productId);

        return ['status' => 'success', 'message' => 'Property detached successfully.'];
    }

    /**
     * Create a new Property from a DeveloperProjectUnitType, with field overrides,
     * then attach it to the deal.
     */
    public function createFromUnitType(Deal $deal, int $unitTypeId, array $overrides): array
    {
        $unitType = DeveloperProjectUnitType::where('id', $unitTypeId)
            ->where('company_id', $deal->company_id)
            ->firstOrFail();

        $property = Property::create([
            'company_id' => $deal->company_id,
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
            'outside_features' => $unitType->outside_features,
            'inside_features' => $unitType->inside_features,
            'completion_date' => $unitType->completion_date,
            'has_restrictions' => $unitType->has_restrictions,
            'restriction_notes' => $unitType->restriction_notes,
            'description' => $unitType->description,
            'title' => $unitType->reference_code
                ? "{$unitType->property_type} - {$unitType->reference_code}"
                : $unitType->property_type,
            'status' => Property::STATUS_AVAILABLE,
            'added_by' => user()->id,
            'responsible_agent_id' => user()->id,
            // Apply overrides
            'price' => $overrides['price'] ?? $unitType->starting_price,
            'floor_number' => $overrides['floor_number'] ?? $unitType->floor,
            'view_types' => $overrides['view_types'] ?? $unitType->view_types,
        ]);

        // Apply feature overrides if provided
        if (isset($overrides['outside_features'])) {
            $property->update(['outside_features' => $overrides['outside_features']]);
        }
        if (isset($overrides['inside_features'])) {
            $property->update(['inside_features' => $overrides['inside_features']]);
        }

        // Create a Product and link
        $product = Product::create([
            'company_id' => $deal->company_id,
            'name' => $property->title ?? 'Property',
            'price' => is_array($property->price) ? ($property->price['amount'] ?? 0) : $property->price,
        ]);

        $property->update(['product_id' => $product->id]);

        $deal->products()->attach($product->id);

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
     * Get unit types for a project.
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
            'name' => $property->title ?? 'Property #' . $property->id,
            'price' => is_array($property->price) ? ($property->price['amount'] ?? 0) : $property->price,
        ]);

        $property->update(['product_id' => $product->id]);

        return $product;
    }
}
