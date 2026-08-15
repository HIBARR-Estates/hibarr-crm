<?php

namespace App\Services;

use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskLifecycleCompletedNotification;
use App\Notifications\TaskLifecycleCreatedNotification;
use App\Notifications\TaskLifecycleDueNotification;
use App\Notifications\TaskLifecycleUpdatedNotification;
use App\Support\FeatureFlags;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class TaskLifecycleNotificationService
{
    private const DUE_CACHE_TTL_HOURS = 26;

    /**
     * @var array<string, bool>
     */
    private static array $oncePerRequest = [];

    public function isEnabled(): bool
    {
        return FeatureFlags::enabled('crm.task-lifecycle-notifications');
    }

    public function notifyCreated(Task $task, ?int $actorId = null): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        $this->once('created', $task->id, function () use ($task, $actorId) {
            $task->loadMissing(['users', 'createBy', 'addedByUser', 'company']);
            $actorId = $actorId ?? $task->added_by;

            $recipients = $this->assignees($task)
                ->filter(fn (User $user) => $actorId === null || (int) $user->id !== (int) $actorId);

            $this->send($recipients, new TaskLifecycleCreatedNotification($task));
        });
    }

    public function notifyUpdated(Task $task, ?int $actorId = null): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        if ($this->wasCompletionTransition($task)) {
            return;
        }

        if (! $this->hasMeaningfulChanges($task)) {
            return;
        }

        $this->once('updated', $task->id, function () use ($task, $actorId) {
            $task->loadMissing(['users', 'createBy', 'addedByUser', 'company']);
            $actorId = $actorId ?? $task->last_updated_by ?? (user() ? user()->id : null);

            if ($actorId === null) {
                return;
            }

            $recipients = $this->assigneesAndAssigner($task)
                ->filter(fn (User $user) => (int) $user->id !== (int) $actorId);

            $this->send($recipients, new TaskLifecycleUpdatedNotification($task));
        });
    }

    public function notifyDue(Task $task): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        if (! $this->claimDueNotification($task)) {
            return;
        }

        $task->loadMissing(['users', 'createBy', 'addedByUser', 'company']);
        $recipients = TaskVisibilityService::reminderRecipients($task);

        $this->send($recipients, new TaskLifecycleDueNotification($task));
    }

    public function notifyCompleted(Task $task, ?int $actorId = null): void
    {
        if (! $this->isEnabled()) {
            return;
        }

        if (! $this->wasCompletionTransition($task)) {
            return;
        }

        $this->once('completed', $task->id, function () use ($task, $actorId) {
            $task->loadMissing(['users', 'createBy', 'addedByUser', 'company', 'boardColumn']);
            $actorId = $actorId ?? (user() ? user()->id : null);

            $recipients = $this->assignees($task)
                ->filter(fn (User $user) => $actorId === null || (int) $user->id !== (int) $actorId);

            if ($recipients->isEmpty()) {
                return;
            }

            $completedBy = $actorId ? User::find($actorId) : null;

            $this->send(
                $recipients,
                new TaskLifecycleCompletedNotification($task, $completedBy)
            );
        });
    }

    public function hasMeaningfulChanges(Task $task): bool
    {
        $tracked = [
            'heading',
            'description',
            'due_date',
            'start_date',
            'priority',
            'task_category_id',
            'project_id',
            'milestone_id',
            'board_column_id',
            'is_private',
            'billable',
            'estimate_hours',
            'estimate_minutes',
            'dependent_task_id',
        ];

        foreach ($tracked as $field) {
            if ($task->wasChanged($field)) {
                if ($field === 'board_column_id' && $this->wasCompletionTransition($task)) {
                    continue;
                }

                return true;
            }
        }

        return false;
    }

    public function wasCompletionTransition(Task $task): bool
    {
        if (! $task->wasChanged('board_column_id')) {
            return false;
        }

        $task->loadMissing('boardColumn');

        return $task->boardColumn?->slug === 'done';
    }

    /**
     * @return Collection<int, User>
     */
    private function assignees(Task $task): Collection
    {
        return $task->users->unique('id')->values();
    }

    /**
     * @return Collection<int, User>
     */
    private function assigneesAndAssigner(Task $task): Collection
    {
        $recipients = $this->assignees($task);
        $assigner = $this->assigner($task);

        if ($assigner && ! $recipients->contains('id', $assigner->id)) {
            $recipients = $recipients->push($assigner);
        }

        return $recipients->unique('id')->values();
    }

    private function assigner(Task $task): ?User
    {
        return $task->createBy ?? $task->addedByUser;
    }

    private function claimDueNotification(Task $task): bool
    {
        if ($task->due_date === null) {
            return false;
        }

        $task->loadMissing('company');
        $timezone = $task->company?->timezone ?? config('app.timezone', 'UTC');
        $dueDateYmd = $task->due_date->copy()->timezone($timezone)->format('Y-m-d');
        $hash = hash('sha256', "task-lifecycle-due|{$task->id}|{$task->company_id}|{$dueDateYmd}");

        return Cache::add("task-lifecycle-due:{$hash}", 1, now()->addHours(self::DUE_CACHE_TTL_HOURS));
    }

    /**
     * @param  Collection<int, User>  $recipients
     */
    private function send(Collection $recipients, object $notification): void
    {
        if ($recipients->isEmpty()) {
            return;
        }

        try {
            Notification::send($recipients, $notification);
        } catch (\Throwable $exception) {
            Log::error('Task lifecycle notification failed.', [
                'notification' => $notification::class,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function once(string $event, int $taskId, callable $callback): void
    {
        $key = "{$event}:{$taskId}";

        if (! empty(self::$oncePerRequest[$key])) {
            return;
        }

        self::$oncePerRequest[$key] = true;
        $callback();
    }

    public static function resetOncePerRequest(): void
    {
        self::$oncePerRequest = [];
    }
}
