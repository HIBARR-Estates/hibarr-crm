<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Support\EntityActivityMailBuilder;
use Illuminate\Notifications\Messages\MailMessage;

class TaskLifecycleDueNotification extends TaskLifecycleBaseNotification
{
    protected function resolveEmailSetting(): ?EmailNotificationSetting
    {
        return EmailNotificationSetting::userAssignTask();
    }

    protected function eventType(): string
    {
        return 'due';
    }

    protected function mailSubject(): string
    {
        return __('email.taskLifecycle.due.subject');
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
        $subject = trim(__('email.taskLifecycle.due.subject').' '.$taskShortCode);
        $introText = $this->safeMailText(__('email.taskLifecycle.due.intro'), 500);
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
        $dueDate = $this->task->due_date
            ? $this->task->due_date->format($this->company->date_format)
            : null;
        $meta = $dueDate !== null ? __('email.dueOn').': '.$dueDate : null;

        return EntityActivityMailBuilder::renderDetailBlock(
            $this->safeMailText($this->task->heading, 200),
            $meta,
            __('email.taskLifecycle.due.warning'),
            warning: true,
        );
    }

    public function toArray($notifiable): array
    {
        $this->eventType = $this->eventType();

        return [
            'id' => $this->task->id,
            'task_id' => $this->task->id,
            'heading' => $this->task->heading,
            'title' => __('email.taskLifecycle.due.subject'),
            'text' => __('email.taskLifecycle.due.intro'),
            'event_type' => $this->eventType,
            'action_url' => getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company),
        ];
    }
}
