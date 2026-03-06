<?php

namespace App\Grpc\Transformers;

use App\Models\DealParticipant;

/**
 * Transforms DealParticipant Eloquent models to gRPC message arrays.
 */
class DealParticipantTransformer
{
    /**
     * Transform a DealParticipant model to a gRPC-compatible array.
     *
     * @param DealParticipant $participant
     * @return array
     */
    public function transform(DealParticipant $participant): array
    {
        return [
            'id' => (int) $participant->id,
            'deal_id' => (int) ($participant->deal_id ?? 0),
            'user_id' => (int) ($participant->user_id ?? 0),
            'created_at' => $this->formatDateTime($participant->created_at),
            'updated_at' => $this->formatDateTime($participant->updated_at),
        ];
    }

    /**
     * Transform a collection of deal participants.
     *
     * @param iterable $participants
     * @return array
     */
    public function transformCollection(iterable $participants): array
    {
        $result = [];
        foreach ($participants as $participant) {
            $result[] = $this->transform($participant);
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
