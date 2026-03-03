<?php

namespace App\Grpc\Transformers;

use App\Models\LeadPipeline;

/**
 * Transforms LeadPipeline Eloquent models to gRPC message arrays.
 */
class LeadPipelineTransformer
{
    /**
     * Transform a LeadPipeline model to a gRPC-compatible array.
     *
     * @param LeadPipeline $leadPipeline
     * @return array
     */
    public function transform(LeadPipeline $leadPipeline): array
    {
        return [
            'id' => (int) $leadPipeline->id,
            'company_id' => (int) ($leadPipeline->company_id ?? 0),
            'name' => (string) ($leadPipeline->name ?? ''),
            'slug' => (string) ($leadPipeline->slug ?? ''),
            'priority' => (int) ($leadPipeline->priority ?? 0),
            'label_color' => (string) ($leadPipeline->label_color ?? ''),
            'default' => (bool) ($leadPipeline->default ?? false),
            'added_by' => (int) ($leadPipeline->added_by ?? 0),
            'created_at' => $this->formatDateTime($leadPipeline->created_at),
            'updated_at' => $this->formatDateTime($leadPipeline->updated_at),
        ];
    }

    /**
     * Transform a collection of lead pipelines.
     *
     * @param iterable $leadPipelines
     * @return array
     */
    public function transformCollection(iterable $leadPipelines): array
    {
        $result = [];
        foreach ($leadPipelines as $leadPipeline) {
            $result[] = $this->transform($leadPipeline);
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
