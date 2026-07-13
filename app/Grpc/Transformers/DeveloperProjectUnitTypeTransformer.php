<?php

namespace App\Grpc\Transformers;

use App\Models\DeveloperProjectUnitType;

/**
 * Transforms DeveloperProjectUnitType Eloquent models to gRPC message arrays.
 */
class DeveloperProjectUnitTypeTransformer
{
    /**
     * Transform a DeveloperProjectUnitType model to a gRPC-compatible array.
     *
     * @param DeveloperProjectUnitType $record
     * @return array
     */
    public function transform(DeveloperProjectUnitType $record): array
    {
        return [
            'id' => (int) $record->id,
            'company_id' => (int) ($record->company_id ?? 0),
            'developer_project_id' => (int) ($record->developer_project_id ?? 0),
            'reference_code' => (string) ($record->reference_code ?? ''),
            'primary_category' => (string) ($record->primary_category ?? ''),
            'property_type' => (string) ($record->property_type ?? ''),
            'unit_style' => is_array($record->unit_style) ? json_encode($record->unit_style) : (string) ($record->unit_style ?? ''),
            'view_types' => is_array($record->view_types) ? json_encode($record->view_types) : (string) ($record->view_types ?? ''),
            'furniture_status' => (string) ($record->furniture_status ?? ''),
            'starting_price' => $record->starting_price !== null ? (string) $record->starting_price : '',
            'currency' => (string) ($record->currency ?? ''),
            'bedrooms' => (int) ($record->bedrooms ?? 0),
            'bathrooms' => (int) ($record->bathrooms ?? 0),
            'floor' => (string) ($record->floor ?? ''),
            'floors_in_building' => (int) ($record->floors_in_building ?? 0),
            'total_area_sqm' => $record->total_area_sqm !== null ? (string) $record->total_area_sqm : '',
            'living_area_sqm' => $record->living_area_sqm !== null ? (string) $record->living_area_sqm : '',
            'terrace_balcony_sqm' => $record->terrace_balcony_sqm !== null ? (string) $record->terrace_balcony_sqm : '',
            'plot_size_sqm' => $record->plot_size_sqm !== null ? (string) $record->plot_size_sqm : '',
            'completion_date' => $this->formatDateTime($record->completion_date),
            'outside_features' => is_array($record->outside_features) ? json_encode($record->outside_features) : (string) ($record->outside_features ?? ''),
            'inside_features' => is_array($record->inside_features) ? json_encode($record->inside_features) : (string) ($record->inside_features ?? ''),
            'description' => (string) ($record->description ?? ''),
            'military_base_distance_km' => $record->military_base_distance_km !== null ? (string) $record->military_base_distance_km : '',
            'has_restrictions' => (bool) $record->has_restrictions,
            'is_sold_out' => (bool) $record->is_sold_out,
            'restriction_notes' => (string) ($record->restriction_notes ?? ''),
            'order' => (int) ($record->order ?? 0),
            'created_at' => $this->formatDateTime($record->created_at),
            'updated_at' => $this->formatDateTime($record->updated_at),
            'deleted_at' => $this->formatDateTime($record->deleted_at),
        ];
    }

    /**
     * Transform a collection of records.
     *
     * @param iterable $records
     * @return array
     */
    public function transformCollection(iterable $records): array
    {
        $result = [];
        foreach ($records as $record) {
            $result[] = $this->transform($record);
        }
        return $result;
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
