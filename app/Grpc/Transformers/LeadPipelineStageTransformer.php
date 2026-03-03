<?php

namespace App\Grpc\Transformers;

use App\Models\LeadPipelineStages;

/**
 * Transforms LeadPipelineStages Eloquent models to gRPC message arrays.
 */
class LeadPipelineStageTransformer
{
    /**
     * Transform a LeadPipelineStages model to a gRPC-compatible array.
     *
     * @param LeadPipelineStages $stage
     * @return array
     */
    public function transform(LeadPipelineStages $stage): array
    {
        return [
            'id' => (int) $stage->id,
            'lead_pipeline_id' => (int) ($stage->lead_pipeline_id ?? 0),
            'pipeline_stages_id' => (int) ($stage->pipeline_stages_id ?? 0),
            'created_at' => $this->formatDateTime($stage->created_at),
            'updated_at' => $this->formatDateTime($stage->updated_at),
        ];
    }

    /**
     * Transform a collection of lead pipeline stages.
     *
     * @param iterable $stages
     * @return array
     */
    public function transformCollection(iterable $stages): array
    {
        $result = [];
        foreach ($stages as $stage) {
            $result[] = $this->transform($stage);
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
