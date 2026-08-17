<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Task;
use App\Support\EntityActivityMailBuilder;
use Illuminate\Notifications\Messages\MailMessage;

class TaskUpdated extends BaseNotification
{
    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $task;

    private $emailSetting;

    public function __construct(Task $task)
    {
        $this->task = $task;
        $this->company = $this->task->load('company')->company;
        $this->emailSetting = EmailNotificationSetting::where('company_id', $this->company->id)->where('slug', 'user-assign-to-task')->first();
        $this->initUnsRouting();
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param  mixed  $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        $via = ['database'];

        if ($this->emailSetting->send_email == 'yes' && $notifiable->email_notifications && $notifiable->email != '') {
            $via[] = 'mail';
        }

        if ($this->emailSetting->send_slack == 'yes' && $this->company->slackSetting->status == 'active') {
            $this->slackUserNameCheck($notifiable) ? $via[] = 'slack' : null;
        }

        return $via;
    }

    /**
     * Get the mail representation of the notification.
     *
     * @param  mixed  $notifiable
     */
    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = getDomainSpecificUrl(route('tasks.show', $this->task->id), $this->company);
        $taskShortCode = $this->task->task_short_code ? '#'.$this->task->task_short_code : '';
        $subject = trim(__('email.taskUpdate.subject').' '.$taskShortCode);
        $introText = $this->capitalizeSentences(__('email.taskUpdate.intro'));
        $detailHtml = EntityActivityMailBuilder::renderDetailBlock(
            $this->safeMailText($this->task->heading, 200),
            $this->taskMetaLine(),
        );
        $actionText = __('email.taskUpdate.action');

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.task.updated', [
                'url' => $url,
                'content' => '',
                'detailHtml' => $detailHtml,
                'preheader' => $this->safePreheader($introText),
                'subject' => $subject,
                'introText' => $introText,
                'actionText' => $actionText,
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
            'actionDescription' => __('email.taskUpdate.footer'),
            'actionText' => $actionText,
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * Get the array representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return array
     */
    // phpcs:ignore
    public function toArray($notifiable)
    {
        return [
            'id' => $this->task->id,
            'task_id' => $this->task->id,
            'updated_at' => $this->task->updated_at->format('Y-m-d H:i:s'),
            'heading' => $this->task->heading,
            'title' => __('email.taskUpdate.subject'),
            'text' => $this->capitalizeSentences(__('email.taskUpdate.intro')),
        ];
    }

    /**
     * Get the Slack representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return \Illuminate\Notifications\Messages\SlackMessage
     */
    public function toSlack($notifiable)
    {

        $labels = '';
        $url = route('tasks.show', $this->task->id);
        $url = getDomainSpecificUrl($url, $this->company);

        foreach ($this->task->labels as $key => $label) {
            if ($key == 0) {
                $labels .= __('app.label').' - ';
            }

            $labels .= $label->label_name;

            if ($key + 1 != count($this->task->labels)) {
                $labels .= ', ';
            }
        }

        return $this->slackBuild($notifiable)
            ->content('*'.__('email.taskUpdate.subject').'*'."\n".'<'.$url.'|'.$this->task->heading.'>'."\n".' #'.$this->task->task_short_code.(! is_null($this->task->project) ? "\n".__('app.project').' - '.$this->task->project->project_name : '')."\n".$labels);

    }

    protected function taskMetaLine(): string
    {
        if (! $this->task->project) {
            return '';
        }

        return $this->safeMailText($this->task->project->project_name, 200);
    }
}
