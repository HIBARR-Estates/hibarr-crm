<?php

namespace App\Services;

use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Collection;

class TaskVisibilityService
{
    /**
     * Tasks visible to a user as assigner (creator) or assignee.
     */
    public static function scopeVisibleToUser(Builder|Relation $query, int $userId): Builder|Relation
    {
        return Task::scopeVisibleToUser($query, $userId);
    }

    /**
     * Permission scope rules for view_tasks (added / owned / both).
     */
    public static function viewPermissionRules(): array
    {
        return [
            'added' => function ($q, User $user) {
                $q->where(function ($query) use ($user) {
                    $query->where('added_by', $user->id)
                        ->orWhere('created_by', $user->id);
                });
            },
            'owned' => function ($q, User $user) {
                $q->whereHas('users', fn ($u) => $u->where('users.id', $user->id));
            },
        ];
    }

    public static function isAssigner(Task $task, int $userId): bool
    {
        return $task->isCreatedBy($userId);
    }

    public static function userCanViewTask(Task $task, User $user, string $viewPermission, array $taskUserIds): bool
    {
        if ($viewPermission === 'all') {
            return true;
        }

        if ($viewPermission === 'none') {
            return false;
        }

        if (self::isAssigner($task, $user->id)) {
            return true;
        }

        $isAssignee = in_array($user->id, $taskUserIds, true);

        return match ($viewPermission) {
            'added' => self::isAssigner($task, $user->id),
            'owned' => $isAssignee,
            'both' => $isAssignee,
            default => false,
        };
    }

    /**
     * Assignees plus assigner (creator), deduplicated.
     */
    public static function reminderRecipients(Task $task): Collection
    {
        $task->loadMissing(['users', 'createBy', 'addedByUser']);

        $recipients = $task->users;

        $assigner = $task->createBy ?? $task->addedByUser;
        if ($assigner && !$recipients->contains('id', $assigner->id)) {
            $recipients = $recipients->push($assigner);
        }

        return $recipients->unique('id')->values();
    }

    public static function formatAssigner(Task $task): ?array
    {
        $assigner = $task->relationLoaded('createBy')
            ? $task->createBy
            : null;

        if (!$assigner && $task->relationLoaded('addedByUser')) {
            $assigner = $task->addedByUser;
        }

        if (!$assigner) {
            $assigner = $task->createBy ?? $task->addedByUser;
        }

        if (!$assigner) {
            return null;
        }

        return [
            'id' => $assigner->id,
            'name' => $assigner->name,
            'image' => $assigner->image_url ?? $assigner->image,
        ];
    }
}
