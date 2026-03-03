<?php

namespace App\Grpc\Transformers;

use App\Models\PipelineStage;

/**
 * Transforms PipelineStage Eloquent models to gRPC message arrays.
 */
class PipelineStageTransformer
{
    /**
     * Transform a PipelineStage model to a gRPC-compatible array.
     *
     * @param PipelineStage $stage
     * @return array
     */
    public function transform(PipelineStage $stage): array
    {
        return [
            'id' => (int) $stage->id,
            'company_id' => (int) ($stage->company_id ?? 0),
            'lead_pipeline_id' => (int) ($stage->lead_pipeline_id ?? 0),
            'name' => (string) ($stage->name ?? ''),
            'slug' => (string) ($stage->slug ?? ''),
            'priority' => (int) ($stage->priority ?? 0),
            'default' => (bool) ($stage->default ?? false),
            'label_color' => (string) ($stage->label_color ?? ''),
            'created_at' => $this->formatDateTime($stage->created_at),
            'updated_at' => $this->formatDateTime($stage->updated_at),
        ];
    }

    /**
     * Transform a collection of pipeline stages.
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
