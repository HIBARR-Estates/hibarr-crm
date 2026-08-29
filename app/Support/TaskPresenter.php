<?php

namespace App\Support;

use App\Models\Task;
use App\Services\TaskVisibilityService;

/**
 * The one Task -> frontend array shape, shared by every surface that needs
 * to open a task in the redesigned Tasks workspace's modals (the Tasks page
 * itself, and — behind the same crm.tasks-workspace-redesign flag — the
 * classic Dashboard, Deal workspace, and Lead workspace task tabs).
 *
 * Originally lived on TaskController as presentTask()/TASK_FRONTEND_*; the
 * list view and the create/update responses used to diverge (raw
 * toFrontendArray() vs. a hand-built array), which is why linked records and
 * attachments could vanish right after saving until the next full list
 * reload replaced the mismatched shape — kept in one place since to make
 * sure that can't happen again, and now reused wherever else a task needs
 * to carry checklist/attachment/linked-record data for those modals.
 *
 * Callers must eager-load self::RELATIONS (+ withCount on self::COUNTS)
 * first — present() only reads what's already loaded, it doesn't lazy-load
 * anything itself.
 */
class TaskPresenter
{
    public const RELATIONS = [
        'project:id,project_name,project_short_code',
        'users:id,name,image',
        'createBy:id,name,image',
        'addedByUser:id,name,image',
        'category:id,category_name',
        'labels',
        'boardColumn:id,column_name,slug,label_color',
        'deals',
        'leads',
        'properties',
        'developerProjects:id,name',
        'subtasks:id,task_id,title,status',
    ];

    public const COUNTS = [
        'files',
        'notes',
        'comments',
        'subtasks',
        'completedSubtasks',
    ];

    public static function present(Task $task, bool $includeFiles = false): array
    {
        $payload = [
            'id' => $task->id,
            'heading' => $task->heading,
            'description' => $task->description,
            'due_date' => Task::wallClockString($task->due_date),
            'start_date' => Task::wallClockString($task->start_date),
            'priority' => $task->priority,
            'status' => $task->boardColumn->slug ?? 'to_do',
            'board_column_id' => $task->board_column_id,
            'completed_on' => Task::wallClockString($task->completed_on),
            'project' => $task->project ? [
                'id' => $task->project->id,
                'project_name' => $task->project->project_name,
                'project_short_code' => $task->project->project_short_code,
            ] : null,
            'category' => $task->category ? [
                'id' => $task->category->id,
                'category_name' => $task->category->category_name,
            ] : null,
            'users' => $task->users->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'image' => $user->image,
                ];
            })->toArray(),
            'labels' => $task->labels->map(function ($label) {
                return [
                    'id' => $label->id,
                    'label_name' => $label->label_name,
                    'label_color' => $label->label_color,
                ];
            })->toArray(),
            'subtasks' => $task->relationLoaded('subtasks')
                ? $task->subtasks->map(fn ($subtask) => [
                    'id' => $subtask->id,
                    'title' => $subtask->title,
                    'status' => $subtask->status,
                ])->toArray()
                : [],
            'files_count' => $task->files_count ?? 0,
            'notes_count' => $task->notes_count ?? 0,
            'comments_count' => $task->comments_count ?? 0,
            'subtasks_count' => $task->subtasks_count ?? 0,
            'completed_subtasks_count' => $task->completed_subtasks_count ?? 0,
            'created_at' => $task->created_at->toISOString(),
            'updated_at' => $task->updated_at->toISOString(),
            'added_by' => $task->added_by,
            'assigner' => TaskVisibilityService::formatAssigner($task),
            'created_by' => TaskVisibilityService::formatAssigner($task),
            'deals' => $task->deals->map(function ($deal) {
                return [
                    'id' => $deal->id,
                    'name' => $deal->name,
                ];
            })->toArray(),
            'leads' => $task->leads->map(function ($lead) {
                return [
                    'id' => $lead->id,
                    'client_name' => $lead->client_name,
                    'company_name' => $lead->company_name,
                ];
            })->toArray(),
            'developer_projects' => $task->developerProjects->map(function ($project) {
                return [
                    'id' => $project->id,
                    'name' => $project->name,
                ];
            })->toArray(),
            'properties' => $task->properties->map(function ($property) {
                return [
                    'id' => $property->id,
                    'name' => $property->title,
                ];
            })->toArray(),
        ];

        if ($includeFiles && $task->relationLoaded('files')) {
            $payload['files'] = self::serializeFiles($task);
        }

        return $payload;
    }

    /**
     * Permission-scoped file payloads — only call after the caller has
     * eager-loaded `files` with view_task_files === 'added' filtering applied.
     *
     * @return array<int, array{id: int, filename: string, size: int, download_url: string}>
     */
    public static function serializeFiles(Task $task): array
    {
        return $task->files->map(fn ($file) => [
            'id' => $file->id,
            'filename' => $file->filename,
            'size' => (int) $file->size,
            'download_url' => route('task_files.download', md5((string) $file->id)),
        ])->toArray();
    }
}
