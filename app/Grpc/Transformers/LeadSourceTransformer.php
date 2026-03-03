<?php

namespace App\Grpc\Transformers;

use App\Models\LeadSource;

/**
 * Transforms LeadSource Eloquent models to gRPC message arrays.
 */
class LeadSourceTransformer
{
    /**
     * Transform a LeadSource model to a gRPC-compatible array.
     *
     * @param LeadSource $leadSource
     * @return array
     */
    public function transform(LeadSource $leadSource): array
    {
        return [
            'id' => (int) $leadSource->id,
            'company_id' => (int) ($leadSource->company_id ?? 0),
            'added_by' => (int) ($leadSource->added_by ?? 0),
            'last_updated_by' => (int) ($leadSource->last_updated_by ?? 0),
            'type' => (string) ($leadSource->type ?? ''),
            'created_at' => $this->formatDateTime($leadSource->created_at),
            'updated_at' => $this->formatDateTime($leadSource->updated_at),
        ];
    }

    /**
     * Transform a collection of lead sources.
     *
     * @param iterable $leadSources
     * @return array
     */
    public function transformCollection(iterable $leadSources): array
    {
        $result = [];
        foreach ($leadSources as $leadSource) {
            $result[] = $this->transform($leadSource);
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
