<?php

namespace App\Grpc\Transformers;

use App\Models\TaskHistory;

/**
 * Transforms TaskHistory Eloquent models to gRPC message arrays.
 */
class TaskHistoryTransformer
{
    /**
     * Transform a TaskHistory model to a gRPC-compatible array.
     *
     * @param TaskHistory $history
     * @return array
     */
    public function transform(TaskHistory $history): array
    {
        return [
            'id' => (int) $history->id,
            'task_id' => (int) ($history->task_id ?? 0),
            'sub_task_id' => (int) ($history->sub_task_id ?? 0),
            'user_id' => (int) ($history->user_id ?? 0),
            'board_column_id' => (int) ($history->board_column_id ?? 0),
            'details' => (string) ($history->details ?? ''),
            'created_at' => $this->formatDateTime($history->created_at),
            'updated_at' => $this->formatDateTime($history->updated_at),
        ];
    }

    /**
     * Transform a collection of task history entries.
     *
     * @param iterable $histories
     * @return array
     */
    public function transformCollection(iterable $histories): array
    {
        $result = [];
        foreach ($histories as $history) {
            $result[] = $this->transform($history);
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
