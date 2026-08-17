<?php

namespace App\Services;

use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\TaskDeleted;
use App\Notifications\TaskOverdue;
use App\Notifications\TaskOverdueForAssigner;
use App\Notifications\TaskPriorityUpdated;
use App\Notifications\TaskRejected;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class TaskNotificationService
{
    public function notifyDeleted(Task $task, ?User $deletedBy = null): void
    {
        $recipients = $this->assignees($task, $deletedBy?->id);
        if ($recipients->isEmpty()) {
            return;
        }

        $this->send($recipients, new TaskDeleted($task, $deletedBy));
    }

    public function notifyRejected(Task $task, string $reason, ?User $rejectedBy = null): void
    {
        $recipients = $this->assignees($task, $rejectedBy?->id);
        if ($recipients->isEmpty()) {
            return;
        }

        $this->send($recipients, new TaskRejected($task, $reason, $rejectedBy));
    }

    public function notifyPriorityChanged(Task $task, ?string $oldPriority = null, ?User $updatedBy = null): void
    {
        $recipients = $this->assignees($task, $updatedBy?->id);
        if ($recipients->isEmpty()) {
            return;
        }

        $this->send($recipients, new TaskPriorityUpdated($task, $oldPriority, $updatedBy));
    }

    public function notifyOverdue(Task $task): void
    {
        $task->loadMissing(['users', 'company', 'project', 'boardColumn']);

        $company = $task->company;
        if (! $company || ! $task->due_date) {
            return;
        }

        $timezone = $company->timezone ?: 'UTC';
        $today = now($timezone)->toDateString();
        $cacheKey = "task_overdue_sent:{$task->id}:{$today}";

        if (Cache::add($cacheKey, true, now($timezone)->endOfDay()) === false) {
            return;
        }

        $assignees = $this->assignees($task);
        $assigners = $this->resolveOverdueAssigners($task, $assignees);

        if ($assignees->isEmpty() && $assigners->isEmpty()) {
            return;
        }

        $daysOverdue = max(1, $task->due_date->copy()->timezone($timezone)->startOfDay()->diffInDays(now($timezone)->startOfDay()));

        if ($assignees->isNotEmpty()) {
            $this->send($assignees, new TaskOverdue($task, (int) $daysOverdue));
        }

        if ($assigners->isNotEmpty()) {
            $assigneeNames = $assignees->pluck('name')->filter()->implode(', ') ?: __('app.na');
            $this->send($assigners, new TaskOverdueForAssigner($task, (int) $daysOverdue, $assigneeNames));
        }
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Task>
     */
    public function overdueTasksForCompany(int $companyId, ?Carbon $now = null): \Illuminate\Database\Eloquent\Collection
    {
        $company = \App\Models\Company::find($companyId);
        if (! $company) {
            return new \Illuminate\Database\Eloquent\Collection;
        }

        $timezone = $company->timezone ?: 'UTC';
        $now = ($now ?? now($timezone))->copy()->timezone($timezone);
        $today = $now->toDateString();

        $doneColumnIds = TaskboardColumn::query()
            ->where('company_id', $companyId)
            ->where('slug', 'done')
            ->pluck('id');

        return Task::query()
            ->with(['users', 'company', 'project', 'boardColumn'])
            ->where('company_id', $companyId)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today)
            ->when($doneColumnIds->isNotEmpty(), fn ($query) => $query->whereNotIn('board_column_id', $doneColumnIds->all()))
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    public function assignees(Task $task, ?int $excludeUserId = null): Collection
    {
        $task->loadMissing('users');

        return $task->users
            ->filter(fn (User $user) => $user->status === 'active')
            ->when($excludeUserId, fn (Collection $users) => $users->reject(
                fn (User $user) => (int) $user->id === (int) $excludeUserId
            ))
            ->unique('id')
            ->values();
    }

    /**
     * Project admin + each assignee's manager — the "assigner" side of an overdue
     * task, notified separately from the assignee with different copy.
     *
     * @param  Collection<int, User>  $assignees
     * @return Collection<int, User>
     */
    private function resolveOverdueAssigners(Task $task, Collection $assignees): Collection
    {
        $recipients = collect();

        $task->loadMissing('project.projectAdmin');
        if ($task->project?->projectAdmin && $task->project->projectAdmin->status === 'active') {
            $recipients->push($task->project->projectAdmin);
        }

        foreach ($assignees as $assignee) {
            $manager = $this->resolveManager($assignee);
            if ($manager) {
                $recipients->push($manager);
            }
        }

        $assigneeIds = $assignees->pluck('id');

        return $recipients
            ->filter(fn ($user) => $user instanceof User && $user->status === 'active')
            ->reject(fn (User $user) => $assigneeIds->contains($user->id))
            ->unique('id')
            ->values();
    }

    private function resolveManager(User $user): ?User
    {
        $user->loadMissing('employeeDetail');

        $reportingTo = $user->employeeDetail?->reporting_to;
        if (! $reportingTo) {
            return null;
        }

        $manager = User::query()
            ->where('id', $reportingTo)
            ->where('status', 'active')
            ->first();

        return $manager instanceof User ? $manager : null;
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
            Notification::send(
                $recipients,
                BaseNotification::applySuppressionFromContainer($notification)
            );
        } catch (\Throwable $exception) {
            Log::error('Task notification failed.', [
                'notification' => $notification::class,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
