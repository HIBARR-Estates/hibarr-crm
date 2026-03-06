<?php

namespace App\Grpc\Transformers;

use App\Models\DealNote;

/**
 * Transforms DealNote Eloquent models to gRPC message arrays.
 */
class DealNoteTransformer
{
    /**
     * Transform a DealNote model to a gRPC-compatible array.
     *
     * @param DealNote $dealNote
     * @return array
     */
    public function transform(DealNote $dealNote): array
    {
        return [
            'id' => (int) $dealNote->id,
            'deal_id' => (int) ($dealNote->deal_id ?? 0),
            'added_by' => (int) ($dealNote->added_by ?? 0),
            'last_updated_by' => (int) ($dealNote->last_updated_by ?? 0),
            'title' => (string) ($dealNote->title ?? ''),
            'details' => (string) ($dealNote->details ?? ''),
            'created_at' => $this->formatDateTime($dealNote->created_at),
            'updated_at' => $this->formatDateTime($dealNote->updated_at),
        ];
    }

    /**
     * Transform a collection of deal notes.
     *
     * @param iterable $dealNotes
     * @return array
     */
    public function transformCollection(iterable $dealNotes): array
    {
        $result = [];
        foreach ($dealNotes as $dealNote) {
            $result[] = $this->transform($dealNote);
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
