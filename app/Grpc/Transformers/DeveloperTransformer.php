<?php

namespace App\Grpc\Transformers;

use App\Models\Developer;

/**
 * Transforms Developer Eloquent models to gRPC message arrays.
 */
class DeveloperTransformer
{
    /**
     * Transform a Developer model to a gRPC-compatible array.
     *
     * @param Developer $record
     * @return array
     */
    public function transform(Developer $record): array
    {
        return [
            'id' => (int) $record->id,
            'company_id' => (int) ($record->company_id ?? 0),
            'name' => (string) ($record->name ?? ''),
            'logo_url' => (string) ($record->logo_url ?? ''),
            'description' => (string) ($record->description ?? ''),
            'project_list' => is_array($record->project_list) ? json_encode($record->project_list) : (string) ($record->project_list ?? ''),
            'whatsapp_group_link' => (string) ($record->whatsapp_group_link ?? ''),
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
