<?php

namespace App\Grpc\Transformers;

use App\Models\DeveloperProjectAsset;

/**
 * Transforms DeveloperProjectAsset Eloquent models to gRPC message arrays.
 */
class DeveloperProjectAssetTransformer
{
    /**
     * Transform a DeveloperProjectAsset model to a gRPC-compatible array.
     *
     * @param DeveloperProjectAsset $record
     * @return array
     */
    public function transform(DeveloperProjectAsset $record): array
    {
        return [
            'id' => (int) $record->id,
            'developer_project_id' => (int) ($record->developer_project_id ?? 0),
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
