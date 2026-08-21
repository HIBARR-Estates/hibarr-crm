<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Support\EntityActivityMailBuilder;
use Illuminate\Notifications\Messages\MailMessage;

class TaskLifecycleCreatedNotification extends TaskLifecycleBaseNotification
{
    protected function resolveEmailSetting(): ?EmailNotificationSetting
    {
        return EmailNotificationSetting::userAssignTask();
    }

    protected function eventType(): string
    {
        return 'created';
    }

    protected function mailSubject(): string
    {
        return __('email.newTask.subject');
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
        $subject = trim(__('email.newTask.subject').' '.$taskShortCode);
        $introText = $this->safeMailText(__('email.newTask.text'), 500);
        $detailHtml = $this->mailDetailHtml($notifiable);
        $actionText = __('email.taskUpdate.action');

        $build
            ->subject($subject.' - '.config('app.name'))
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

        $this->attachTaskLifecyclePlunk($build, [
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

    protected function mailDetailHtml($notifiable): string
    {
        $meta = $this->task->due_date
            ? __('app.dueDate').': '.$this->task->due_date->format($this->company->date_format)
            : ($this->taskMetaLine() ?: null);

        return EntityActivityMailBuilder::renderDetailBlock(
            $this->safeMailText($this->task->heading, 200),
            $meta,
        );
    }

    protected function taskMetaLine(): string
    {
        if (! $this->task->project) {
            return '';
        }

        return $this->safeMailText($this->task->project->project_name, 200);
    }

    public function toArray($notifiable): array
    {
        $this->eventType = $this->eventType();

        return [
            'id' => $this->task->id,
            'task_id' => $this->task->id,
            'heading' => $this->task->heading,
            'title' => __('email.newTask.subject'),
            'text' => __('email.newTask.text'),
            'event_type' => $this->eventType,
            'action_url' => getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company),
        ];
    }
}
