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

    public static function fromProperty($property, string $layout, array $sections = []): self
    {
        $agent = $property->product->addedBy ?? auth()->user();
        
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
                'title' => $property->title,
                'price' => number_format($property->price, 2) . ' €',
                'address' => $property->city,
                'bedrooms' => $property->bedrooms,
                'bathrooms' => $property->bathrooms,
                'area' => $property->area,
                'land_size' => $property->land_size,
                'property_type' => $property->property_type,
                'building_age' => $property->building_age,
                'description' => $property->description,
                'created_at' => $property->created_at->format('M d, Y'),
                'features' => array_merge(
                    $property->exterior_features ?? [],
                    $property->interior_features ?? [],
                    $property->location_features ?? []
                ),
                'exterior_features' => $property->exterior_features ?? [],
                'interior_features' => $property->interior_features ?? [],
                'location_features' => $property->location_features ?? [],
                'assets' => $assetsByTag,
                'agent' => [
                    'name' => $agent->name ?? 'N/A',
                    'email' => $agent->email ?? 'N/A',
                    'phone' => $agent->mobile ?? 'N/A',
                    'image' => $agent->image_url ?? null,
                ],
                'company' => [
                    'name' => config('app.name'),
                    'logo' => public_path('img/logo.png'),
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