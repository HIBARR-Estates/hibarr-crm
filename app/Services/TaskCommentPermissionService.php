<?php

namespace App\Services;

use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;

/**
 * Shared add/delete comment permission checks for the JSON API and legacy
 * controllers — keeps scoped permission semantics consistent.
 */
class TaskCommentPermissionService
{
    public function canAddComment(User $user, Task $task, ?string $permission = null): bool
    {
        $permission ??= $user->permission('add_task_comments');
        $assigneeIds = $task->relationLoaded('users')
            ? $task->users->pluck('id')->all()
            : $task->users()->pluck('users.id')->all();

        return $this->matchesTaskScope(
            $permission,
            (int) $user->id,
            (int) $task->added_by,
            $assigneeIds,
        );
    }

    public function canDeleteComment(User $user, TaskComment $comment, ?string $permission = null): bool
    {
        $permission ??= $user->permission('delete_task_comments');

        if ($permission === 'all') {
            return true;
        }

        $authorId = (int) ($comment->added_by ?: $comment->user_id);

        if ($permission === 'added') {
            return $authorId === (int) $user->id;
        }

        return false;
    }

    /**
     * @param  array<int, int|string>  $assigneeIds
     */
    private function matchesTaskScope(
        string $permission,
        int $userId,
        int $addedBy,
        array $assigneeIds,
    ): bool {
        if ($permission === 'all') {
            return true;
        }

        if ($permission === 'none' || $permission === '') {
            return false;
        }

        $isCreator = $addedBy === $userId;
        $isAssignee = in_array($userId, array_map('intval', $assigneeIds), true);

        return match ($permission) {
            'added' => $isCreator,
            'owned' => $isAssignee,
            'both' => $isCreator || $isAssignee,
            default => false,
        };
    }
}
