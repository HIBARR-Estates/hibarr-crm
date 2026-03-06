<?php

namespace App\Grpc\Transformers;

use App\Models\Taskable;

/**
 * Transforms Taskable Eloquent models to gRPC message arrays.
 */
class TaskableTransformer
{
    /**
     * Transform a Taskable model to a gRPC-compatible array.
     *
     * @param Taskable $taskable
     * @return array
     */
    public function transform(Taskable $taskable): array
    {
        return [
            'id' => (int) $taskable->id,
            'task_id' => (int) ($taskable->task_id ?? 0),
            'taskable_id' => (int) ($taskable->taskable_id ?? 0),
            'taskable_type' => (string) ($taskable->taskable_type ?? ''),
            'created_at' => $this->formatDateTime($taskable->created_at),
            'updated_at' => $this->formatDateTime($taskable->updated_at),
        ];
    }

    /**
     * Transform a collection of taskables.
     *
     * @param iterable $taskables
     * @return array
     */
    public function transformCollection(iterable $taskables): array
    {
        $result = [];
        foreach ($taskables as $taskable) {
            $result[] = $this->transform($taskable);
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
