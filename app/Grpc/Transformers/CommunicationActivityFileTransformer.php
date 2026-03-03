<?php

namespace App\Grpc\Transformers;

use App\Models\CommunicationActivityFile;

/**
 * Transforms CommunicationActivityFile Eloquent models to gRPC message arrays.
 */
class CommunicationActivityFileTransformer
{
    /**
     * Transform a CommunicationActivityFile model to a gRPC-compatible array.
     *
     * @param CommunicationActivityFile $file
     * @return array
     */
    public function transform(CommunicationActivityFile $file): array
    {
        return [
            'id' => (int) $file->id,
            'activity_id' => (int) ($file->activity_id ?? 0),
            'file_url' => (string) ($file->file_url ?? ''),
            'file_type' => (string) ($file->file_type ?? ''),
            'file_size' => (int) ($file->file_size ?? 0),
            'created_at' => $this->formatDateTime($file->created_at),
            'updated_at' => $this->formatDateTime($file->updated_at),
        ];
    }

    /**
     * Transform a collection of communication activity files.
     *
     * @param iterable $files
     * @return array
     */
    public function transformCollection(iterable $files): array
    {
        $result = [];
        foreach ($files as $file) {
            $result[] = $this->transform($file);
        }
        return $result;
    }

    /**
     * Format a datetime value to ISO 8601 string.
     *
     * @param mixed $value
     * @return string
     */
    private function formatDateTime(mixed $value): string
    {
        if ($value === null) return '';
        if ($value instanceof \DateTimeInterface) return $value->format('c');
        return (string) $value;
    }
}
