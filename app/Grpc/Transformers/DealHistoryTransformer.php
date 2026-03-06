<?php

namespace App\Grpc\Transformers;

use App\Models\DealHistory;

/**
 * Transforms DealHistory Eloquent models to gRPC message arrays.
 */
class DealHistoryTransformer
{
    /**
     * Transform a DealHistory model to a gRPC-compatible array.
     *
     * @param DealHistory $dealHistory
     * @return array
     */
    public function transform(DealHistory $dealHistory): array
    {
        return [
            'id' => (int) $dealHistory->id,
            'deal_id' => (int) ($dealHistory->deal_id ?? 0),
            'created_by' => (int) ($dealHistory->created_by ?? 0),
            'deal_stage_to_id' => (int) ($dealHistory->deal_stage_to_id ?? 0),
            'event_type' => (string) ($dealHistory->event_type ?? ''),
            'deal_stage_from_id' => (int) ($dealHistory->deal_stage_from_id ?? 0),
            'file_id' => (int) ($dealHistory->file_id ?? 0),
            'task_id' => (int) ($dealHistory->task_id ?? 0),
            'follow_up_id' => (int) ($dealHistory->follow_up_id ?? 0),
            'note_id' => (int) ($dealHistory->note_id ?? 0),
            'proposal_id' => (int) ($dealHistory->proposal_id ?? 0),
            'agent_id' => (int) ($dealHistory->agent_id ?? 0),
            'created_at' => $this->formatDateTime($dealHistory->created_at),
            'updated_at' => $this->formatDateTime($dealHistory->updated_at),
        ];
    }

    /**
     * Transform a collection of deal histories.
     *
     * @param iterable $dealHistories
     * @return array
     */
    public function transformCollection(iterable $dealHistories): array
    {
        $result = [];
        foreach ($dealHistories as $dealHistory) {
            $result[] = $this->transform($dealHistory);
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
