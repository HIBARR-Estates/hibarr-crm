<?php

namespace App\Grpc\Transformers;

use App\Models\DealFile;

/**
 * Transforms DealFile Eloquent models to gRPC message arrays.
 */
class DealFileTransformer
{
    /**
     * Transform a DealFile model to a gRPC-compatible array.
     *
     * @param DealFile $dealFile
     * @return array
     */
    public function transform(DealFile $dealFile): array
    {
        return [
            'id' => (int) $dealFile->id,
            'deal_id' => (int) ($dealFile->deal_id ?? 0),
            'user_id' => (int) ($dealFile->user_id ?? 0),
            'added_by' => (int) ($dealFile->added_by ?? 0),
            'last_updated_by' => (int) ($dealFile->last_updated_by ?? 0),
            'filename' => (string) ($dealFile->filename ?? ''),
            'hashname' => (string) ($dealFile->hashname ?? ''),
            'size' => (string) ($dealFile->size ?? ''),
            'description' => (string) ($dealFile->description ?? ''),
            'google_url' => (string) ($dealFile->google_url ?? ''),
            'dropbox_link' => (string) ($dealFile->dropbox_link ?? ''),
            'created_at' => $this->formatDateTime($dealFile->created_at),
            'updated_at' => $this->formatDateTime($dealFile->updated_at),
        ];
    }

    /**
     * Transform a collection of deal files.
     *
     * @param iterable $dealFiles
     * @return array
     */
    public function transformCollection(iterable $dealFiles): array
    {
        $result = [];
        foreach ($dealFiles as $dealFile) {
            $result[] = $this->transform($dealFile);
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
