<?php

namespace App\Services\PdfExpose\Configuration;

use Illuminate\Contracts\Support\Arrayable;

class ExposeConfiguration implements Arrayable
{
    public function __construct(
        public readonly string $entityType,        // 'property', 'developer_project', etc.
        public readonly int $entityId,
        public readonly string $layout,            // 'vertical', 'horizontal'
        public readonly array $sections,           // Sections to include
        public readonly array $data,               // Actual data to populate
        public readonly array $options = [],       // Additional options
    ) {}

    public static function fromProperty($property, string $layout, array $clientData = [], array $sections = []): self
    {
        $agent = $property->product->addedBy ?? auth()->user();
        $company = company();
        
        // Group assets by tags
        $assetsByTag = [];
        $availableTags = ['hero', 'area', 'exterior', 'interior', 'floor-plan', 'facilities', 'footer', 'gallery'];
        
        foreach ($availableTags as $tag) {
            $assetsByTag[$tag] = $property->assets()
                ->where('asset_type', 'image')
                ->whereJsonContains('tags', $tag)
                ->orderBy('order')
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(fn($asset) => $asset->url)
                ->filter()
                ->values()
                ->toArray();
        }

        return new self(
            entityType: 'property',
            entityId: $property->id,
            layout: $layout,
            sections: $sections ?: ['header', 'images', 'details', 'description', 'location', 'contact'],
            data: [
                // Basic property info
                'title' => $property->title ?? $property->display_title ?? $property->reference_code,
                'reference_code' => $property->reference_code,
                'price' => number_format($property->price ?? 0, 2) . ' €',
                'raw_price' => $property->price,
                
                // Location
                'city' => $property->city,
                'area' => $property->area, // District/area name
                'address' => $property->address ?? $property->city,
                'latitude' => $property->latitude,
                'longitude' => $property->longitude,
                
                // Size & rooms
                'living_area_sqm' => $property->living_area_sqm,
                'gross_sqm' => $property->gross_sqm,
                'land_size' => $property->land_size,
                'terrace_area_sqm' => $property->terrace_area_sqm,
                'bedrooms' => $property->bedrooms,
                'bathrooms' => $property->bathrooms,
                'rooms' => $property->rooms,
                'living_room' => $property->living_room,
                'floor_number' => $property->floor_number,
                'floors_in_building' => $property->floors_in_building,
                'balcony_count' => $property->balcony_count,
                'balcony_net_sqm' => $property->balcony_net_sqm,
                
                // Property classification
                'property_type' => $property->property_type,
                'primary_category' => $property->primary_category,
                'unit_style' => is_array($property->unit_style) ? implode(' / ', array_map('ucfirst', $property->unit_style)) : ($property->unit_style ?? null),
                'sale_type' => $property->sale_type,
                'status' => $property->status,
                'block_name' => $property->block_name,
                'unit_number' => $property->unit_number,
                
                // Building info
                'building_age' => $property->building_age,
                'completion_date' => $property->completion_date?->format('Y'),
                'construction_status' => $property->construction_status,
                'furniture_status' => $property->furniture_status,
                'heating_type' => $property->heating_type,
                'title_deed_type' => $property->title_deed_type,
                
                // Content
                'description' => $property->description,
                'created_at' => $property->created_at->format('M d, Y'),
                
                // Features (combined for backward compatibility)
                'features' => array_merge(
                    $property->exterior_features ?? [],
                    $property->interior_features ?? [],
                    $property->location_features ?? []
                ),
                
                // Feature arrays (separate)
                'exterior_features' => $property->exterior_features ?? [],
                'interior_features' => $property->interior_features ?? [],
                'location_features' => $property->location_features ?? [],
                'outside_features' => $property->outside_features ?? [],
                'inside_features' => $property->inside_features ?? [],
                'view_types' => $property->view_types ?? [],
                
                // Distances (for infrastructure page)
                'distances' => $property->distances ?? [],
                
                // Assets grouped by tags
                'assets' => $assetsByTag,
                
                // Agent info
                'agent' => [
                    'name' => $agent->name ?? 'N/A',
                    'email' => $agent->email ?? 'N/A',
                    'phone' => $agent->mobile ?? 'N/A',
                    'image' => $agent->image_url ?? null,
                    'position' => $agent->designation ?? null,
                ],
                
                // Company branding
                'company' => [
                    'name' => $company?->company_name ?? config('app.name'),
                    'logo' => $company?->logo_url ?? public_path('img/logo.png'),
                    'address' => $company?->address ?? null,
                    'phone' => $company?->company_phone ?? null,
                    'email' => $company?->company_email ?? null,
                    'website' => $company?->website ?? null,
                ],
                
                // Client personalization
                'client' => [
                    'name' => $clientData['client_name'] ?? null,
                    'email' => $clientData['client_email'] ?? null,
                ],
            ],
            options: [
                'include_qr_code' => true,
                'watermark' => false,
            ]
        );
    }

    public static function fromDeveloperProject($project, string $layout): self
    {
        return new self(
            entityType: 'developer_project',
            entityId: $project->id,
            layout: $layout,
            sections: ['header', 'overview', 'units', 'amenities', 'location', 'contact'],
            data: [
                'title' => $project->name,
                'developer' => $project->developer_name,
                'completion_date' => $project->completion_date,
                'units' => $project->units,
                // ... more project-specific data
            ],
            options: []
        );
    }

    /**
     * Create configuration for project expose with selected properties and lead info.
     *
     * @param \App\Models\DeveloperProject $project
     * @param \Illuminate\Support\Collection $properties
     * @param array $lead Lead info (either existing lead or new lead data)
     * @param \App\Models\User $generatedBy User who is generating the expose
     * @param string $layout Layout template to use
     * @return self
     */
    public static function fromProjectWithProperties($project, $properties, array $lead, $generatedBy, string $layout = 'vertical_standard'): self
    {
        $company = company();
        
        // Group property assets by tags
        $assetsByTag = [
            'hero' => [],
            'exterior' => [],
            'interior' => [],
            'floor-plan' => [],
            'facilities' => [],
            'gallery' => [],
        ];

        $propertiesData = [];
        foreach ($properties as $property) {
            // Collect assets from each property
            foreach (array_keys($assetsByTag) as $tag) {
                $propertyAssets = $property->assets()
                    ->where('asset_type', 'image')
                    ->whereJsonContains('tags', $tag)
                    ->orderBy('order')
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(fn($asset) => $asset->url)
                    ->filter()
                    ->values()
                    ->toArray();
                $assetsByTag[$tag] = array_merge($assetsByTag[$tag], $propertyAssets);
            }

            // Collect property data
            $propertiesData[] = [
                'id' => $property->id,
                'title' => $property->title,
                'price' => $property->price,
                'formatted_price' => $property->price ? number_format($property->price, 2) . ' €' : null,
                'bedrooms' => $property->bedrooms,
                'bathrooms' => $property->bathrooms,
                'area' => $property->area,
                'property_type' => $property->property_type,
                'status' => $property->status,
                'description' => $property->description,
                'exterior_features' => $property->exterior_features ?? [],
                'interior_features' => $property->interior_features ?? [],
                'location_features' => $property->location_features ?? [],
            ];
        }

        // Also collect project-level assets
        if ($project->relationLoaded('assets') || method_exists($project, 'assets')) {
            foreach (array_keys($assetsByTag) as $tag) {
                $projectAssets = $project->assets()
                    ->where('asset_type', 'image')
                    ->whereJsonContains('tags', $tag)
                    ->orderBy('order')
                    ->orderBy('created_at', 'desc')
                    ->get()
                    ->map(fn($asset) => $asset->url)
                    ->filter()
                    ->values()
                    ->toArray();
                $assetsByTag[$tag] = array_merge($assetsByTag[$tag], $projectAssets);
            }
        }

        return new self(
            entityType: 'project_expose',
            entityId: $project->id,
            layout: $layout,
            sections: ['header', 'lead_info', 'project_overview', 'properties', 'amenities', 'location', 'contact', 'footer'],
            data: [
                // Project info
                'project' => [
                    'name' => $project->name,
                    'description' => $project->description,
                    'developer' => $project->developer?->name ?? null,
                    'location' => $project->location?->name ?? null,
                ],
                // Lead info
                'lead' => [
                    'name' => $lead['client_name'] ?? $lead['name'] ?? 'N/A',
                    'email' => $lead['client_email'] ?? $lead['email'] ?? null,
                    'phone' => $lead['mobile'] ?? $lead['phone'] ?? null,
                    'company' => $lead['company_name'] ?? null,
                ],
                // Properties
                'properties' => $propertiesData,
                'properties_count' => count($propertiesData),
                // Assets
                'assets' => $assetsByTag,
                // Generated by info
                'generated_by' => [
                    'name' => $generatedBy->name ?? 'N/A',
                    'email' => $generatedBy->email ?? 'N/A',
                    'phone' => $generatedBy->mobile ?? null,
                    'image' => $generatedBy->image_url ?? null,
                ],
                // Company branding
                'company' => [
                    'name' => $company?->company_name ?? config('app.name'),
                    'logo' => $company?->logo_url ?? public_path('img/logo.png'),
                    'address' => $company?->address ?? null,
                    'phone' => $company?->company_phone ?? null,
                    'email' => $company?->company_email ?? null,
                    'website' => $company?->website ?? null,
                ],
                // Generation metadata
                'generated_at' => now()->format('M d, Y H:i'),
            ],
            options: [
                'include_qr_code' => true,
                'watermark' => false,
                'include_footer' => true,
            ]
        );
    }

    public function toArray(): array
    {
        return [
            'entity_type' => $this->entityType,
            'entity_id' => $this->entityId,
            'layout' => $this->layout,
            'sections' => $this->sections,
            'data' => $this->data,
            'options' => $this->options,
        ];
    }

    public function get(string $key, $default = null): mixed
    {
        return data_get($this->data, $key, $default);
    }

    public function has(string $key): bool
    {
        return data_get($this->data, $key) !== null;
    }
}