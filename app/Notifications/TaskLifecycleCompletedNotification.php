<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Task;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;

class TaskLifecycleCompletedNotification extends TaskLifecycleBaseNotification
{
    private ?User $completedBy;

    public function __construct(Task $task, ?User $completedBy = null)
    {
        $this->completedBy = $completedBy;
        parent::__construct($task);
    }

    protected function resolveEmailSetting(): ?EmailNotificationSetting
    {
        return EmailNotificationSetting::where('company_id', $this->company->id)
            ->where('slug', 'task-completed')
            ->first();
    }

    protected function eventType(): string
    {
        return 'completed';
    }

    protected function mailSubject(): string
    {
        return __('email.taskComplete.subject');
    }

    protected function mailView(): string
    {
        return 'mail.email';
    }

    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = route('tasks.show', $this->task->id);
        $url = getDomainSpecificUrl($url, $this->company);
        $taskShortCode = $this->task->task_short_code ? '#' . $this->task->task_short_code : ' ';

        $build
            ->subject(__('email.taskComplete.subject') . $taskShortCode . ' - ' . config('app.name') . '.')
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $this->mailContent($notifiable),
                'themeColor' => $this->company->header_color,
                'actionText' => __('email.taskComplete.action'),
                'notifiableName' => $notifiable->name,
            ]);

        parent::resetLocale();

        return $build;
    }

    protected function mailContent($notifiable): string
    {
        $projectTitle = $this->task->project
            ? __('app.project') . ' - ' . $this->task->project->project_name
            : '';
        $completedByName = $this->completedBy?->name ?? __('app.system');

        return __('email.taskComplete.subject') . '<br>'
            . __('email.taskComplete.completedBy') . ': ' . $completedByName . '<br>'
            . __('app.task') . ': ' . $this->task->heading . '<br>'
            . $projectTitle;
    }
}
