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
        $images = $property->photos ?? [];

        return new self(
            entityType: 'property',
            entityId: $property->id,
            layout: $layout,
            sections: $sections ?: ['header', 'images', 'details', 'description', 'location', 'contact'],
            data: [
                'title' => $property->title,
                'price' => $property->price,
                'address' => $property->city,
                'bedrooms' => $property->bedrooms,
                'bathrooms' => $property->bathrooms,
                'area' => $property->area,
                'description' => $property->description,
                'features' => array_merge(
                    $property->exterior_features ?? [],
                    $property->interior_features ?? [],
                    $property->location_features ?? []
                ),
                'images' => $images,
                'agent' => [
                    'name' => $agent->name ?? null,
                    'email' => $agent->email ?? null,
                    'phone' => $agent->mobile ?? null,
                ],
                'company' => [
                    'name' => config('app.name'),
                    'logo' => asset('img/logo.png'),
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