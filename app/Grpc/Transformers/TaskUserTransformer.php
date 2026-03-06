<?php

namespace App\Grpc\Transformers;

use App\Models\TaskUser;

/**
 * Transforms TaskUser Eloquent models to gRPC message arrays.
 */
class TaskUserTransformer
{
    /**
     * Transform a TaskUser model to a gRPC-compatible array.
     *
     * @param TaskUser $taskUser
     * @return array
     */
    public function transform(TaskUser $taskUser): array
    {
        return [
            'id' => (int) $taskUser->id,
            'task_id' => (int) ($taskUser->task_id ?? 0),
            'user_id' => (int) ($taskUser->user_id ?? 0),
            'created_at' => $this->formatDateTime($taskUser->created_at),
            'updated_at' => $this->formatDateTime($taskUser->updated_at),
        ];
    }

    /**
     * Transform a collection of task users.
     *
     * @param iterable $taskUsers
     * @return array
     */
    public function transformCollection(iterable $taskUsers): array
    {
        $result = [];
        foreach ($taskUsers as $taskUser) {
            $result[] = $this->transform($taskUser);
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
