<?php

namespace Modules\Performance\Notifications;

use Modules\Performance\Entities\PerformanceSetting;
use App\Notifications\BaseNotification;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use NotificationChannels\OneSignal\OneSignalChannel;
use NotificationChannels\OneSignal\OneSignalMessage;

class NotifyAssigneeForObjective extends BaseNotification
{
    use Queueable;

    private $objective;
    private $emailSetting;

    /**
     * Create a new notification instance.
     */
    public function __construct($objective)
    {
        $this->objective = $objective;
        $this->company = $objective->company;
        $this->emailSetting = PerformanceSetting::where('company_id', $this->company->id)->first();
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via($notifiable): array
    {
        $via = ['database'];

        if ($this->emailSetting->objective_email_notification == 'yes' && $notifiable->email_notifications && $notifiable->email != '') {
            array_push($via, 'mail');
        }

        if ($this->emailSetting->objective_slack_notification == 'yes' && $this->company->slackSetting->status == 'active') {
            $this->slackUserNameCheck($notifiable) ? array_push($via, 'slack') : null;
        }

        if ($this->emailSetting->objective_push_notification == 'yes' && push_setting()->status == 'active') {
            array_push($via, OneSignalChannel::class);
        }

        // if ($this->emailSetting->objective_push_notification == 'yes' && push_setting()->beams_push_status == 'active') {
        //     $pushNotification = new \App\Http\Controllers\DashboardController();
        //     $pushUsersIds = [[$notifiable->id]];
        //     $pushNotification->sendPushNotifications($pushUsersIds, __('performance::email.objective.subject'), $this->objective->title);
        // }

        if ($this->emailSetting->objective_push_notification == 'yes' && push_setting()->beams_push_status == 'active') {
            $pushNotification = new \App\Http\Controllers\DashboardController();
            $pushUsersIds = [[$notifiable->id]];
            dispatch(function () use ($pushNotification, $pushUsersIds) {
                $pushNotification->sendPushNotifications($pushUsersIds, __('performance::email.objective.subject'), $this->objective->title);
            });
        }

        return $via;
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $url = route('objectives.show', $this->objective->id);
        $url = getDomainSpecificUrl($url, $this->company);

        $subject = '🏷️ ' . __('performance::email.objective.subject') . ': ' . $this->objective->title;
        $startDate = $this->objective->start_date ? Carbon::parse($this->objective->start_date)->format($this->company->date_format) : '--';
        $endDate = $this->objective->end_date ? Carbon::parse($this->objective->end_date)->format($this->company->date_format) : '--';

        $content = __('performance::email.objective.title') . ':<br><br>' .
            '🔍 <b>' . __('performance::email.objective.objectiveTitle') . ':</b> ' . $this->objective->title . '<br><br>' .
            '📝 <b>' . __('performance::email.objective.description') . ':</b> ' . $this->objective->description . '<br><br>' .
            '📅 <b>' . __('performance::email.objective.startDate') . ':</b> ' . $startDate . '<br><br>' .
            '📅 <b>' . __('performance::email.objective.endDate') . ':</b> ' . $endDate . '<br><br>' .
            '🏷️ <b>' . __('performance::email.objective.goalType') . ':</b> ' . ($this->objective->goalType ? __('performance::app.' . $this->objective->goalType->type) : '--') . '<br><br>' .
            '🚀 <b>' . __('performance::email.objective.priorityLevel') . ':</b> ' . ($this->objective->priority ? __('performance::app.' . $this->objective->priority) : '--') . '<br><br>' .
            '📈 <b>' . __('performance::email.objective.checkInFrequency') . ':</b> ' . $this->objective->check_in_frequency . '<br><br>' .
            '<b>' . __('performance::email.objective.actionRequired') . ':</b> ' . __('performance::email.objective.actionRequiredText') . '<br><br>' .
            __('performance::email.objective.actionRequiredNote') . '<br>';
        $build
            ->subject($subject)
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $content,
                'actionText' => __('performance::email.objective.viewObjective'),
                'themeColor' => $this->company->header_color,
                'notifiableName' => $notifiable->name
            ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray($notifiable): array
    {
        return [
            'id' => $this->objective->id,
            'heading' => $this->objective->title,
            'created_at' => $this->objective->created_at ?? Carbon::parse($this->objective->created_at)->format('Y-m-d H:i:s'),
        ];
    }

    public function toSlack($notifiable)
    {
        try {
            $subject = '🏷️ ' . __('performance::email.objective.subject') . ': ' . $this->objective->title;
            $greeting = '*' . __('performance::email.objective.hi') . ' ' . $notifiable->name . '*,';
            $startDate = $this->objective->start_date ? Carbon::parse($this->objective->start_date)->format($this->company->date_format) : '--';
            $endDate = $this->objective->end_date ? Carbon::parse($this->objective->end_date)->format($this->company->date_format) : '--';

            $content = __('performance::email.objective.title') ."\n\n" .
                '🔍 *' . __('performance::email.objective.objectiveTitle') . '*: ' . $this->objective->title . "\n\n" .
                '📝 *' . __('performance::email.objective.description') . '*: ' . $this->objective->description . "\n\n" .
                '📅 *' . __('performance::email.objective.startDate') . '*: ' . $startDate . "\n\n" .
                '📅 *' . __('performance::email.objective.endDate') . '*: ' . $endDate . "\n\n" .
                '🏷️ *' . __('performance::email.objective.goalType') . '*: ' . $this->objective->goalType->type . "\n\n" .
                '🚀 *' . __('performance::email.objective.priorityLevel') . '*: ' . $this->objective->priority . "\n\n" .
                '📈 *' . __('performance::email.objective.checkInFrequency') . '*: ' . $this->objective->check_in_frequency . "\n\n" .
                '*' . __('performance::email.objective.actionRequired') . '*: ' . __('performance::email.objective.actionRequiredText') . "\n\n" .
                __('performance::email.objective.actionRequiredNote') . "\n\n";

            $url = route('objectives.show', $this->objective->id);
            $url = getDomainSpecificUrl($url, $this->company);
            $url = '<'.$url.'|' . __('performance::email.objective.viewObjective') . '>';

            return $this->slackBuild($notifiable)
                ->content($subject . "\n\n" . $greeting . "\n\n" . $content . "\n\n" . $url);
        }
        catch (\Exception $e) {
            return $this->slackRedirectMessage('performance::email.objective.subject', $notifiable);
        }
    }

    public function toOneSignal()
    {
        return OneSignalMessage::create()
            ->setSubject(__('performance::email.objective.subject'))
            ->setBody($this->objective->title);
    }

}
