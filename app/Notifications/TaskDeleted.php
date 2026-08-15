<?php

namespace App\Notifications;

use App\Models\Task;
use App\Models\User;
use App\Support\EntityActivityMailBuilder;

class TaskDeleted extends TaskAssigneeNotification
{
    private ?User $deletedBy;

    public function __construct(Task $task, ?User $deletedBy = null)
    {
        $this->deletedBy = $deletedBy;
        parent::__construct($task, 'task-deleted');
    }

    protected function pushTitle(): string
    {
        return __('email.taskDeleted.subject');
    }

    protected function mailSubject(): string
    {
        return __('email.taskDeleted.subject').$this->taskShortCode().'- '.config('app.name').'.';
    }

    protected function mailContent($notifiable): string
    {
        return '';
    }

    protected function mailIntro($notifiable): string
    {
        $deletedByName = $this->deletedBy?->name ?? __('app.system');

        return "{$deletedByName} deleted a task. This action cannot be undone.";
    }

    protected function mailDetailHtml($notifiable): string
    {
        return EntityActivityMailBuilder::renderDetailBlock(
            $this->safeMailText($this->task->heading, 200),
            $this->taskMetaLine(),
            __('This action cannot be undone.'),
            true,
        );
    }

    protected function actionText(): string
    {
        return __('email.taskDeleted.action');
    }
}
