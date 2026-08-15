<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Task;
use App\Models\User;
use App\Support\EntityActivityMailBuilder;
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
        return 'mail.task.activity';
    }

    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company);
        $taskShortCode = $this->task->task_short_code ? '#'.$this->task->task_short_code : '';
        $subject = trim(__('email.taskComplete.subject').' '.$taskShortCode);
        $introText = $this->safeMailText($this->mailIntro($notifiable), 500);
        $detailHtml = $this->mailDetailHtml($notifiable);
        $actionText = __('email.taskComplete.action');

        $build
            ->subject(__('email.taskComplete.subject').$taskShortCode.' - '.config('app.name').'.')
            ->view('mail.task.activity', [
                'url' => $url,
                'content' => '',
                'detailHtml' => $detailHtml,
                'preheader' => $this->safePreheader($introText),
                'subject' => $subject,
                'badgeLabel' => 'Task Update',
                'actionText' => $actionText,
                'introText' => $introText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $introText,
            'badgeLabel' => 'Task Update',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'detailHtml' => $detailHtml,
            'contentHtml' => '',
            'actionDescription' => __('Click the button below to view the task details.'),
            'actionText' => $actionText,
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    protected function mailIntro($notifiable): string
    {
        $completedByName = $this->completedBy?->name ?? __('app.system');

        return "{$completedByName} marked a task as completed.";
    }

    protected function mailDetailHtml($notifiable): string
    {
        $meta = $this->task->project
            ? $this->safeMailText($this->task->project->project_name, 200)
            : '';

        return EntityActivityMailBuilder::renderDetailBlock(
            $this->safeMailText($this->task->heading, 200),
            $meta,
            __('Task completed.'),
        );
    }

    protected function mailContent($notifiable): string
    {
        return $this->task->heading;
    }

    public function toArray($notifiable): array
    {
        $this->eventType = $this->eventType();

        return [
            'id' => $this->task->id,
            'task_id' => $this->task->id,
            'heading' => $this->task->heading,
            'title' => __('email.taskComplete.subject'),
            'text' => $this->mailIntro($notifiable),
            'event_type' => $this->eventType,
            'action_url' => getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company),
        ];
    }
}
