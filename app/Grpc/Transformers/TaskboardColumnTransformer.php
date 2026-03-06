<?php

namespace App\Grpc\Transformers;

use App\Models\TaskboardColumn;

/**
 * Transforms TaskboardColumn Eloquent models to gRPC message arrays.
 */
class TaskboardColumnTransformer
{
    /**
     * Transform a TaskboardColumn model to a gRPC-compatible array.
     *
     * @param TaskboardColumn $column
     * @return array
     */
    public function transform(TaskboardColumn $column): array
    {
        return [
            'id' => (int) $column->id,
            'company_id' => (int) ($column->company_id ?? 0),
            'column_name' => (string) ($column->column_name ?? ''),
            'slug' => (string) ($column->slug ?? ''),
            'label_color' => (string) ($column->label_color ?? ''),
            'priority' => (int) ($column->priority ?? 0),
            'created_at' => $this->formatDateTime($column->created_at),
            'updated_at' => $this->formatDateTime($column->updated_at),
        ];
    }

    /**
     * Transform a collection of taskboard columns.
     *
     * @param iterable $columns
     * @return array
     */
    public function transformCollection(iterable $columns): array
    {
        $result = [];
        foreach ($columns as $column) {
            $result[] = $this->transform($column);
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
