<?php

namespace App\Services;

use App\Models\DeveloperProjectUnitType;
use App\Models\Property;
use Illuminate\Support\Collection;

/**
 * Transforms DeveloperProjectUnitType models into Property-compatible shapes
 * so they can be displayed alongside real properties in the listing.
 */
class UnitTypePropertyTransformer
{
    /**
     * Transform a collection of unit types into property-like arrays.
     *
     * @param  Collection<DeveloperProjectUnitType>  $unitTypes  — must have project.location, project.developer, assets loaded
     * @return Collection<array>
     */
    public function transformMany(Collection $unitTypes): Collection
    {
        // Pre-load which unit types already have sold properties
        $unitTypeIds = $unitTypes->pluck('id')->all();
        $soldMap = Property::whereIn('developer_project_unit_type_id', $unitTypeIds)
            ->select('developer_project_unit_type_id', 'id', 'status')
            ->get()
            ->groupBy('developer_project_unit_type_id');

        return $unitTypes->map(function (DeveloperProjectUnitType $ut) use ($soldMap) {
            return $this->transform($ut, $soldMap->get($ut->id));
        });
    }

    /**
     * Transform a single unit type into a property-compatible array.
     *
     * @param  DeveloperProjectUnitType  $ut
     * @param  Collection|null           $soldProperties — pre-fetched sold properties for this UT
     * @return array
     */
    public function transform(DeveloperProjectUnitType $ut, $soldProperties = null): array
    {
        $project = $ut->project;
        $location = $project?->location;
        $developer = $project?->developer;

        // Count how many properties have been created from this unit type
        $soldCount = $soldProperties ? $soldProperties->count() : 0;

        // Build a display title from the unit type label
        $displayTitle = $ut->display_label ?: 'Unit Type';
        $title = $displayTitle;
        if ($project) {
            $title = $project->name . ' — ' . $displayTitle;
        }

        // Build price in the same format as Property.price (simple number)
        $price = $ut->starting_price ? (float) $ut->starting_price : 0;

        return [
            // Synthetic ID: negative to never collide with real properties
            'id' => -$ut->id,
            'product_id' => 0,
            'developer_project_id' => $ut->developer_project_id,
            'developer_project_unit_type_id' => $ut->id,
            'project_location_id' => $project?->project_location_id,
            'added_by' => null,
            'responsible_agent_id' => null,

            // Type info
            'property_type' => $ut->property_type ?? 'apartment',
            'primary_category' => $ut->primary_category ?? 'residential',
            'unit_style' => $ut->unit_style,
            'construction_status' => $project?->construction_status,
            'sale_type' => 'sale',
            'price' => $price,
            'currency' => $ut->currency ?? 'GBP',

            // Status — unit types are always available (they're templates that can be sold many times)
            'status' => 'Available',
            'is_published' => true,
            'published_at' => $ut->created_at,

            // Location (from developer project location)
            'city' => $location?->address['city'] ?? $location?->name ?? '',
            'area' => $location?->address['state'] ?? '',

            // Specs
            'bedrooms' => $ut->bedrooms,
            'bathrooms' => $ut->bathrooms,
            'floor_number' => is_numeric($ut->floor) ? (int) $ut->floor : null,
            'floors_in_building' => $ut->floors_in_building,
            'living_area_sqm' => $ut->living_area_sqm ? (float) $ut->living_area_sqm : null,
            'total_area_sqm' => $ut->total_area_sqm ? (float) $ut->total_area_sqm : null,
            'terrace_area_sqm' => $ut->terrace_balcony_sqm ? (float) $ut->terrace_balcony_sqm : null,
            'plot_size_sqm' => $ut->plot_size_sqm ? (float) $ut->plot_size_sqm : null,
            'completion_date' => $ut->completion_date?->format('Y-m-d'),
            'furniture_status' => $ut->furniture_status,
            'view_types' => $ut->view_types,

            // Features
            'exterior_features' => $ut->outside_features,
            'interior_features' => $ut->inside_features,
            'outside_features' => $ut->outside_features,
            'inside_features' => $ut->inside_features,

            // Content
            'title' => $title,
            'description' => $ut->description,

            // Legal
            'has_restrictions' => $ut->has_restrictions,
            'restriction_notes' => $ut->restriction_notes,

            // Computed attributes expected by the frontend
            'reference_code' => $ut->reference_code ?? '',
            'display_title' => $title,
            'effective_location' => [
                'city' => $location?->address['city'] ?? $location?->name ?? null,
                'area' => $location?->address['state'] ?? null,
            ],
            'has_project_location' => $project?->project_location_id !== null,

            // Relationships
            'developer_project' => $project ? [
                'id' => $project->id,
                'name' => $project->name,
            ] : null,

            // Discriminator fields
            '_source' => 'unit_type',
            '_unit_type_id' => $ut->id,
            '_developer_project_id' => $ut->developer_project_id,
            '_developer_project_name' => $project?->name,
            '_sold_count' => $soldCount,
            '_sold_property_ids' => $soldProperties ? $soldProperties->pluck('id')->values()->all() : [],

            // Timestamps
            'created_at' => $ut->created_at?->toISOString(),
            'updated_at' => $ut->updated_at?->toISOString(),

            // Defaults for missing fields
            'is_furnished' => false,
            'within_site' => true,
            'open_to_trade' => false,
            'photos' => [],
            'assets' => [],
        ];
    }
}
