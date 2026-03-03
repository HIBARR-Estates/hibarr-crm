<?php

namespace App\Grpc\Transformers;

use App\Models\TaskCategory;

/**
 * Transforms TaskCategory Eloquent models to gRPC message arrays.
 */
class TaskCategoryTransformer
{
    /**
     * Transform a TaskCategory model to a gRPC-compatible array.
     *
     * @param TaskCategory $category
     * @return array
     */
    public function transform(TaskCategory $category): array
    {
        return [
            'id' => (int) $category->id,
            'company_id' => (int) ($category->company_id ?? 0),
            'added_by' => (int) ($category->added_by ?? 0),
            'last_updated_by' => (int) ($category->last_updated_by ?? 0),
            'category_name' => (string) ($category->category_name ?? ''),
            'created_at' => $this->formatDateTime($category->created_at),
            'updated_at' => $this->formatDateTime($category->updated_at),
        ];
    }

    /**
     * Transform a collection of task categories.
     *
     * @param iterable $categories
     * @return array
     */
    public function transformCollection(iterable $categories): array
    {
        $result = [];
        foreach ($categories as $category) {
            $result[] = $this->transform($category);
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
