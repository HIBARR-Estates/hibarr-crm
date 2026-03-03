<?php

namespace App\Grpc\Transformers;

use App\Models\MeetingSummary;

/**
 * Transforms MeetingSummary Eloquent models to gRPC message arrays.
 */
class MeetingSummaryTransformer
{
    /**
     * Transform a MeetingSummary model to a gRPC-compatible array.
     *
     * @param MeetingSummary $summary
     * @return array
     */
    public function transform(MeetingSummary $summary): array
    {
        return [
            'id' => (int) $summary->id,
            'meeting_type_id' => (int) ($summary->meeting_type_id ?? 0),
            'deal_id' => (int) ($summary->deal_id ?? 0),
            'summary_object' => is_array($summary->summary_object) || is_object($summary->summary_object) ? json_encode($summary->summary_object) : (string) ($summary->summary_object ?? ''),
            'created_at' => $this->formatDateTime($summary->created_at),
            'updated_at' => $this->formatDateTime($summary->updated_at),
        ];
    }

    /**
     * Transform a collection of meeting summaries.
     *
     * @param iterable $summaries
     * @return array
     */
    public function transformCollection(iterable $summaries): array
    {
        $result = [];
        foreach ($summaries as $summary) {
            $result[] = $this->transform($summary);
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
