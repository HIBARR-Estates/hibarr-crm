<?php

namespace App\Grpc\Transformers;

use App\Models\LeadCategory;

/**
 * Transforms LeadCategory Eloquent models to gRPC message arrays.
 */
class LeadCategoryTransformer
{
    /**
     * Transform a LeadCategory model to a gRPC-compatible array.
     *
     * @param LeadCategory $leadCategory
     * @return array
     */
    public function transform(LeadCategory $leadCategory): array
    {
        return [
            'id' => (int) $leadCategory->id,
            'company_id' => (int) ($leadCategory->company_id ?? 0),
            'added_by' => (int) ($leadCategory->added_by ?? 0),
            'last_updated_by' => (int) ($leadCategory->last_updated_by ?? 0),
            'category_name' => (string) ($leadCategory->category_name ?? ''),
            'is_default' => (bool) ($leadCategory->is_default ?? false),
            'created_at' => $this->formatDateTime($leadCategory->created_at),
            'updated_at' => $this->formatDateTime($leadCategory->updated_at),
        ];
    }

    /**
     * Transform a collection of lead categories.
     *
     * @param iterable $leadCategories
     * @return array
     */
    public function transformCollection(iterable $leadCategories): array
    {
        $result = [];
        foreach ($leadCategories as $leadCategory) {
            $result[] = $this->transform($leadCategory);
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
