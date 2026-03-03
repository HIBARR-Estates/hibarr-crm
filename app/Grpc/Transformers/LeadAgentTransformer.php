<?php

namespace App\Grpc\Transformers;

use App\Models\LeadAgent;

/**
 * Transforms LeadAgent Eloquent models to gRPC message arrays.
 * Uses flat structure with ID references only (no nested objects).
 */
class LeadAgentTransformer
{
    /**
     * Transform a LeadAgent model to a gRPC-compatible array.
     *
     * @param LeadAgent $leadAgent
     * @return array
     */
    public function transform(LeadAgent $leadAgent): array
    {
        return [
            'id' => (int) $leadAgent->id,
            'company_id' => (int) ($leadAgent->company_id ?? 0),
            'user_id' => (int) ($leadAgent->user_id ?? 0),
            'lead_category_id' => (int) ($leadAgent->lead_category_id ?? 0),
            'added_by' => (int) ($leadAgent->added_by ?? 0),
            'last_updated_by' => (int) ($leadAgent->last_updated_by ?? 0),
            'status' => (string) ($leadAgent->status ?? ''),
            'created_at' => $this->formatDateTime($leadAgent->created_at),
            'updated_at' => $this->formatDateTime($leadAgent->updated_at),
        ];
    }

    /**
     * Transform a collection of lead agents.
     *
     * @param iterable $leadAgents
     * @return array
     */
    public function transformCollection(iterable $leadAgents): array
    {
        $result = [];
        foreach ($leadAgents as $leadAgent) {
            $result[] = $this->transform($leadAgent);
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
