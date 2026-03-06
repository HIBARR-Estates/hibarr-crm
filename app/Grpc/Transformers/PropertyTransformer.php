<?php

namespace App\Grpc\Transformers;

use App\Models\Property;

/**
 * Transforms Property Eloquent models to gRPC message arrays.
 * Uses flat structure with ID references only (no nested objects).
 * JSON array/object fields are serialized as JSON strings.
 */
class PropertyTransformer
{
    /**
     * Transform a Property model to a gRPC-compatible array.
     *
     * @param Property $property
     * @return array
     */
    public function transform(Property $property): array
    {
        return [
            'id' => (int) $property->id,
            'title' => (string) ($property->title ?? ''),
            'slug' => (string) ($property->slug ?? ''),
            'description' => (string) ($property->description ?? ''),
            'reference_code' => (string) ($property->reference_code ?? ''),
            
            // Property classification
            'property_type' => (string) ($property->property_type ?? ''),
            'primary_category' => (string) ($property->primary_category ?? ''),
            'unit_style' => (string) ($property->unit_style ?? ''),
            'construction_status' => (string) ($property->construction_status ?? ''),
            'sale_type' => (string) ($property->sale_type ?? ''),
            'status' => (string) ($property->status ?? ''),
            
            // Pricing (JSON serialized)
            'price_json' => $this->encodeJson($property->getRawOriginal('price')),
            
            // Location
            'city' => (string) ($property->city ?? ''),
            'area' => (string) ($property->area ?? ''),
            'state' => (string) ($property->state ?? ''),
            
            // Property dimensions
            'land_size' => (float) ($property->land_size ?? 0),
            'living_area_sqm' => (float) ($property->living_area_sqm ?? 0),
            'terrace_area_sqm' => (float) ($property->terrace_area_sqm ?? 0),
            
            // Property details
            'bedrooms' => (int) ($property->bedrooms ?? 0),
            'bathrooms' => (int) ($property->bathrooms ?? 0),
            'living_room' => (int) ($property->living_room ?? 0),
            'floor_number' => (int) ($property->floor_number ?? 0),
            'floors_in_building' => (int) ($property->floors_in_building ?? 0),
            'building_age' => (int) ($property->building_age ?? 0),
            'completion_date' => $this->formatDate($property->completion_date),
            
            // Property status
            'furniture_status' => (string) ($property->furniture_status ?? ''),
            'current_occupancy' => (string) ($property->current_occupancy ?? ''),
            
            // Features (JSON arrays serialized)
            'view_types_json' => $this->encodeJson($property->view_types),
            'exterior_features_json' => $this->encodeJson($property->exterior_features),
            'interior_features_json' => $this->encodeJson($property->interior_features),
            'location_features_json' => $this->encodeJson($property->location_features),
            
            // Media and documents (JSON arrays)
            'photos_json' => $this->encodeJson($property->photos),
            'add_ons_json' => $this->encodeJson($property->add_ons),
            'documents_checklist_json' => $this->encodeJson($property->documents_checklist),
            
            // Additional info (JSON objects)
            'owner_info_json' => $this->encodeJson($property->owner_info),
            'legal_info_json' => $this->encodeJson($property->legal_info),
            'financial_info_json' => $this->encodeJson($property->financial_info),
            'land_details_json' => $this->encodeJson($property->land_details),
            
            // Publishing
            'is_published' => (bool) $property->is_published,
            'published_at' => $this->formatDateTime($property->published_at),
            'allow_101evler' => (bool) $property->allow_101evler,
            'allow_hangiev' => (bool) $property->allow_hangiev,
            
            // Foreign key references (flat)
            'product_id' => (int) ($property->product_id ?? 0),
            'developer_project_id' => (int) ($property->developer_project_id ?? 0),
            'project_location_id' => (int) ($property->project_location_id ?? 0),
            'responsible_agent_id' => (int) ($property->responsible_agent_id ?? 0),
            'added_by' => (int) ($property->added_by ?? 0),
            'company_id' => (int) ($property->company_id ?? 0),
            
            // Metadata
            'created_at' => $this->formatDateTime($property->created_at),
            'updated_at' => $this->formatDateTime($property->updated_at),
        ];
    }

    /**
     * Transform a collection of properties.
     *
     * @param iterable $properties
     * @return array
     */
    public function transformCollection(iterable $properties): array
    {
        $result = [];
        foreach ($properties as $property) {
            $result[] = $this->transform($property);
        }
        return $result;
    }

    /**
     * Encode a value to JSON string.
     *
     * @param mixed $value
     * @return string
     */
    protected function encodeJson($value): string
    {
        if ($value === null) {
            return '';
        }
        
        if (is_string($value)) {
            // Already JSON string
            return $value;
        }
        
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '';
    }

    /**
     * Format a date to ISO8601 string.
     *
     * @param mixed $date
     * @return string
     */
    protected function formatDate($date): string
    {
        if ($date === null) {
            return '';
        }
        
        if ($date instanceof \Carbon\Carbon || $date instanceof \DateTime) {
            return $date->format('Y-m-d');
        }
        
        return (string) $date;
    }

    /**
     * Format a datetime to ISO8601 string.
     *
     * @param mixed $datetime
     * @return string
     */
    protected function formatDateTime($datetime): string
    {
        if ($datetime === null) {
            return '';
        }
        
        if ($datetime instanceof \Carbon\Carbon || $datetime instanceof \DateTime) {
            return $datetime->toIso8601String();
        }
        
        return (string) $datetime;
    }
}
