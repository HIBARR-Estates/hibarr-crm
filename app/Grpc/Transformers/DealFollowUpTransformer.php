<?php

namespace App\Grpc\Transformers;

use App\Models\DealFollowUp;

/**
 * Transforms DealFollowUp Eloquent models to gRPC message arrays.
 */
class DealFollowUpTransformer
{
    /**
     * Transform a DealFollowUp model to a gRPC-compatible array.
     *
     * @param DealFollowUp $followUp
     * @return array
     */
    public function transform(DealFollowUp $followUp): array
    {
        return [
            'id' => (int) $followUp->id,
            'deal_id' => (int) ($followUp->deal_id ?? 0),
            'added_by' => (int) ($followUp->added_by ?? 0),
            'last_updated_by' => (int) ($followUp->last_updated_by ?? 0),
            'summary_id' => (int) ($followUp->summary_id ?? 0),
            'meeting_type_id' => (int) ($followUp->meeting_type_id ?? 0),
            'remark' => (string) ($followUp->remark ?? ''),
            'next_follow_up_date' => $this->formatDateTime($followUp->next_follow_up_date),
            'event_id' => (string) ($followUp->event_id ?? ''),
            'meeting_id' => (string) ($followUp->meeting_id ?? ''),
            'send_reminder' => (string) ($followUp->send_reminder ?? ''),
            'remind_time' => (string) ($followUp->remind_time ?? ''),
            'remind_type' => (string) ($followUp->remind_type ?? ''),
            'reminders' => is_array($followUp->reminders) || is_object($followUp->reminders) ? json_encode($followUp->reminders) : (string) ($followUp->reminders ?? ''),
            'status' => (string) ($followUp->status ?? ''),
            'location' => (string) ($followUp->location ?? ''),
            'meeting_link' => (string) ($followUp->meeting_link ?? ''),
            'participants' => is_array($followUp->participants) || is_object($followUp->participants) ? json_encode($followUp->participants) : (string) ($followUp->participants ?? ''),
            'created_at' => $this->formatDateTime($followUp->created_at),
            'updated_at' => $this->formatDateTime($followUp->updated_at),
        ];
    }

    /**
     * Transform a collection of deal follow-ups.
     *
     * @param iterable $followUps
     * @return array
     */
    public function transformCollection(iterable $followUps): array
    {
        $result = [];
        foreach ($followUps as $followUp) {
            $result[] = $this->transform($followUp);
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
