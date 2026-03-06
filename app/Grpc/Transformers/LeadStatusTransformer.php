<?php

namespace App\Grpc\Transformers;

use App\Models\LeadStatus;

/**
 * Transforms LeadStatus Eloquent models to gRPC message arrays.
 */
class LeadStatusTransformer
{
    /**
     * Transform a LeadStatus model to a gRPC-compatible array.
     *
     * @param LeadStatus $leadStatus
     * @return array
     */
    public function transform(LeadStatus $leadStatus): array
    {
        return [
            'id' => (int) $leadStatus->id,
            'company_id' => (int) ($leadStatus->company_id ?? 0),
            'type' => (string) ($leadStatus->type ?? ''),
            'priority' => (int) ($leadStatus->priority ?? 0),
            'default' => (bool) ($leadStatus->default ?? false),
            'label_color' => (string) ($leadStatus->label_color ?? ''),
            'created_at' => $this->formatDateTime($leadStatus->created_at),
            'updated_at' => $this->formatDateTime($leadStatus->updated_at),
        ];
    }

    /**
     * Transform a collection of lead statuses.
     *
     * @param iterable $leadStatuses
     * @return array
     */
    public function transformCollection(iterable $leadStatuses): array
    {
        $result = [];
        foreach ($leadStatuses as $leadStatus) {
            $result[] = $this->transform($leadStatus);
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
