<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\SubTask;
use Illuminate\Notifications\Messages\MailMessage;

class SubTaskCreated extends BaseNotification
{
    private SubTask $subTask;

    private ?EmailNotificationSetting $emailSetting;

    public function __construct(SubTask $subTask)
    {
        $this->subTask = $subTask;
        $this->company = $this->subTask->task->company;
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'sub-task-created')
                ->first()
            : null;
        $this->initTaskMailRouting();
    }

    /**
     * @param  mixed  $notifiable
     * @return array<int, string>
     */
    public function via($notifiable)
    {
        $via = ['database'];

        if (
            $this->emailSetting
            && $this->emailSetting->send_email === 'yes'
            && $notifiable->email_notifications
            && filled($notifiable->email)
        ) {
            $via[] = 'mail';
        }

        if (
            $this->emailSetting
            && $this->emailSetting->send_slack === 'yes'
            && $this->company?->slackSetting?->status === 'active'
            && $this->slackUserNameCheck($notifiable)
        ) {
            $via[] = 'slack';
        }

        return $via;
    }

    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = route('tasks.show', [$this->subTask->task->id, 'view' => 'sub_task']);
        $url = getDomainSpecificUrl($url, $this->company);

        $content = $this->subTask->title.' — '.__('email.subTaskCreated.text').'<br>'
            .((! is_null($this->subTask->task->project)) ? __('app.project').' - '.$this->subTask->task->project->project_name : '');
        $subject = __('email.subTaskCreated.subject');
        $introText = $this->safeMailText($this->subTask->title.' — '.__('email.subTaskCreated.text'), 500);

        $build
            ->subject(__('email.subTaskCreated.subject').' - '.config('app.name').'.')
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $content,
                'themeColor' => $this->company?->header_color,
                'actionText' => __('email.subTaskCreated.action'),
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $introText,
            'badgeLabel' => 'Task Update',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $content,
            'actionDescription' => __('Click the button below to view the task details.'),
            'actionText' => __('email.subTaskCreated.action'),
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * @param  mixed  $notifiable
     * @return array<string, mixed>
     */
    public function toArray($notifiable)
    {
        return [
            'id' => $this->subTask->task->id,
            'task_id' => $this->subTask->task->id,
            'created_at' => $this->subTask->created_at->format('Y-m-d H:i:s'),
            'heading' => $this->subTask->title,
            'title' => __('email.subTaskCreated.subject'),
        ];
    }
}
