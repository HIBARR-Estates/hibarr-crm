<?php

namespace App\Grpc\Transformers;

use App\Models\DeveloperProject;

/**
 * Transforms DeveloperProject Eloquent models to gRPC message arrays.
 */
class DeveloperProjectTransformer
{
    /**
     * Transform a DeveloperProject model to a gRPC-compatible array.
     *
     * @param DeveloperProject $record
     * @return array
     */
    public function transform(DeveloperProject $record): array
    {
        return [
            'id' => (int) $record->id,
            'company_id' => (int) ($record->company_id ?? 0),
            'developer_id' => (int) ($record->developer_id ?? 0),
            'project_location_id' => (int) ($record->project_location_id ?? 0),
            'name' => (string) ($record->name ?? ''),
            'reference_code' => (string) ($record->reference_code ?? ''),
            'description' => (string) ($record->description ?? ''),
            'google_drive_link' => (string) ($record->google_drive_link ?? ''),
            'availability_link' => (string) ($record->availability_link ?? ''),
            'starting_price' => $record->starting_price !== null ? (string) $record->starting_price : '',
            'primary_categories' => is_array($record->primary_categories) ? json_encode($record->primary_categories) : (string) ($record->primary_categories ?? ''),
            'title_deed_type' => (string) ($record->title_deed_type ?? ''),
            'unit_types' => is_array($record->unit_types) ? json_encode($record->unit_types) : (string) ($record->unit_types ?? ''),
            'number_of_units' => (int) ($record->number_of_units ?? 0),
            'number_of_blocks' => (int) ($record->number_of_blocks ?? 0),
            'project_total_area_sqm' => $record->project_total_area_sqm !== null ? (string) $record->project_total_area_sqm : '',
            'construction_status' => (string) ($record->construction_status ?? ''),
            'completion_date' => $this->formatDateTime($record->completion_date),
            'number_of_phases' => (int) ($record->number_of_phases ?? 0),
            'furniture_package' => (string) ($record->furniture_package ?? ''),
            'rental_guarantee' => (bool) $record->rental_guarantee,
            'payment_plan' => is_array($record->payment_plan) || is_object($record->payment_plan) ? json_encode($record->payment_plan) : (string) ($record->payment_plan ?? ''),
            'facilities' => is_array($record->facilities) ? json_encode($record->facilities) : (string) ($record->facilities ?? ''),
            'distances' => is_array($record->distances) || is_object($record->distances) ? json_encode($record->distances) : (string) ($record->distances ?? ''),
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
