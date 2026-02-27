<?php

namespace App\Grpc\Transformers;

use App\Models\Task;

/**
 * Transforms Task Eloquent models to gRPC message arrays.
 * Uses flat structure with ID references only (no nested objects).
 */
class TaskTransformer
{
    /**
     * Transform a Task model to a gRPC-compatible array.
     *
     * @param Task $task
     * @return array
     */
    public function transform(Task $task): array
    {
        return [
            'id' => (int) $task->id,
            'heading' => (string) ($task->heading ?? ''),
            'description' => (string) ($task->description ?? ''),
            'task_short_code' => (string) ($task->task_short_code ?? ''),
            
            // Dates
            'start_date' => $this->formatDateTime($task->start_date),
            'due_date' => $this->formatDateTime($task->due_date),
            'completed_on' => $this->formatDate($task->completed_on),
            
            // Priority and status
            'priority' => (string) ($task->priority ?? ''),
            'status' => (string) ($task->status ?? ''),
            'column_priority' => (int) ($task->column_priority ?? 0),
            
            // Foreign key references (flat)
            'project_id' => (int) ($task->project_id ?? 0),
            'board_column_id' => (int) ($task->board_column_id ?? 0),
            'task_category_id' => (int) ($task->task_category_id ?? 0),
            'milestone_id' => (int) ($task->milestone_id ?? 0),
            'company_id' => (int) ($task->company_id ?? 0),
            'created_by' => (int) ($task->created_by ?? 0),
            'added_by' => (int) ($task->added_by ?? 0),
            'last_updated_by' => (int) ($task->last_updated_by ?? 0),
            
            // Task properties
            'is_private' => (bool) $task->is_private,
            'billable' => (bool) $task->billable,
            'estimate_hours' => (int) ($task->estimate_hours ?? 0),
            'estimate_minutes' => (int) ($task->estimate_minutes ?? 0),
            
            // Recurring task fields
            'repeat' => (bool) $task->repeat,
            'repeat_count' => (int) ($task->repeat_count ?? 0),
            'repeat_type' => (string) ($task->repeat_type ?? ''),
            'repeat_cycles' => (int) ($task->repeat_cycles ?? 0),
            'recurring_task_id' => (int) ($task->recurring_task_id ?? 0),
            'dependent_task_id' => (int) ($task->dependent_task_id ?? 0),
            
            // Event linkage
            'event_id' => (int) ($task->event_id ?? 0),
            
            // Metadata
            'created_at' => $this->formatDateTime($task->created_at),
            'updated_at' => $this->formatDateTime($task->updated_at),
            'deleted_at' => $this->formatDateTime($task->deleted_at),
            
            // Related IDs (many-to-many as ID arrays)
            'assignee_ids' => $this->extractIds($task->users ?? collect()),
            'label_ids' => $this->extractIds($task->labels ?? collect()),
            
            // Polymorphic relations (taskables)
            'deal_ids' => $this->extractIds($task->deals ?? collect()),
            'lead_ids' => $this->extractIds($task->leads ?? collect()),
            'property_ids' => $this->extractIds($task->properties ?? collect()),
        ];
    }

    /**
     * Transform a collection of tasks.
     *
     * @param iterable $tasks
     * @return array
     */
    public function transformCollection(iterable $tasks): array
    {
        $result = [];
        foreach ($tasks as $task) {
            $result[] = $this->transform($task);
        }
        return $result;
    }

    /**
     * Format a date to ISO8601 string.
     *
     * @param mixed $date
     * @return string
     */
    protected function formatDate($date): string
    {
        if ($date === null) {
            return '';
        }
        
        if ($date instanceof \Carbon\Carbon || $date instanceof \DateTime) {
            return $date->format('Y-m-d');
        }
        
        return (string) $date;
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

    /**
     * Extract IDs from a collection of related models.
     *
     * @param iterable $collection
     * @return array
     */
    protected function extractIds(iterable $collection): array
    {
        $ids = [];
        foreach ($collection as $item) {
            if (isset($item->id)) {
                $ids[] = (int) $item->id;
            }
        }
        return $ids;
    }
}
