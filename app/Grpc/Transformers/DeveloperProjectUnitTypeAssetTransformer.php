<?php

namespace App\Grpc\Transformers;

use App\Models\DeveloperProjectUnitTypeAsset;

/**
 * Transforms DeveloperProjectUnitTypeAsset Eloquent models to gRPC message arrays.
 */
class DeveloperProjectUnitTypeAssetTransformer
{
    /**
     * Transform a DeveloperProjectUnitTypeAsset model to a gRPC-compatible array.
     *
     * @param DeveloperProjectUnitTypeAsset $record
     * @return array
     */
    public function transform(DeveloperProjectUnitTypeAsset $record): array
    {
        return [
            'id' => (int) $record->id,
            'unit_type_id' => (int) ($record->unit_type_id ?? 0),
            'company_id' => (int) ($record->company_id ?? 0),
            'name' => (string) ($record->name ?? ''),
            'asset_type' => (string) ($record->asset_type ?? ''),
            'file_path' => (string) ($record->file_path ?? ''),
            'external_url' => (string) ($record->external_url ?? ''),
            'mime_type' => (string) ($record->mime_type ?? ''),
            'file_size' => (int) ($record->file_size ?? 0),
            'tags' => is_array($record->tags) ? json_encode($record->tags) : (string) ($record->tags ?? ''),
            'metadata' => is_array($record->metadata) || is_object($record->metadata) ? json_encode($record->metadata) : (string) ($record->metadata ?? ''),
            'order' => (int) ($record->order ?? 0),
            'created_at' => $this->formatDateTime($record->created_at),
            'updated_at' => $this->formatDateTime($record->updated_at),
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
