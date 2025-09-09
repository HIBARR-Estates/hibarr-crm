<?php

namespace Modules\Performance\Notifications;

use App\Notifications\BaseNotification;
use Modules\Performance\Entities\Meeting;
use NotificationChannels\OneSignal\OneSignalChannel;
use Modules\Performance\Entities\PerformanceSetting;
use NotificationChannels\OneSignal\OneSignalMessage;

class MeetingInviteNotification extends BaseNotification
{

    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $meeting;
    private $emailSetting;

    public function __construct(Meeting $meeting)
    {
        $this->meeting = $meeting;
        $this->company = $this->meeting->company;
        $this->emailSetting = PerformanceSetting::where('company_id', $this->company->id)->first();
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        $via = ['database'];

        if ($this->emailSetting->meeting_email_notification == 'yes' && $notifiable->email_notifications && $notifiable->email != '') {
            array_push($via, 'mail');
        }

        if ($this->emailSetting->meeting_slack_notification == 'yes' && $this->company->slackSetting->status == 'active') {
            $this->slackUserNameCheck($notifiable) ? array_push($via, 'slack') : null;
        }

        if ($this->emailSetting->meeting_push_notification == 'yes' && push_setting()->status == 'active') {
            array_push($via, OneSignalChannel::class);
        }

        if ($this->emailSetting->meeting_push_notification == 'yes' && push_setting()->beams_push_status == 'active') {
            $pushNotification = new \App\Http\Controllers\DashboardController();
            $pushUsersIds = [[$notifiable->id]];
            $pushNotification->sendPushNotifications($pushUsersIds, __('performance::email.meeting.subject'), __('performance::email.meeting.youHaveBeenInvited'));
        }

        return $via;
    }

    /**
     * @param mixed $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     * @throws \Exception
     */
    public function toMail($notifiable)
    {
        $meetingInvite = parent::build($notifiable);
        $vCalendar = new \Eluceo\iCal\Component\Calendar('www.example.com');
        $vEvent = new \Eluceo\iCal\Component\Event();
        $vEvent
            ->setDtStart(new \DateTime($this->meeting->start_date_time))
            ->setDtEnd(new \DateTime($this->meeting->end_date_time))
            ->setNoTime(true)
            ->setSummary($this->meeting->meeting_name);
        $vCalendar->addComponent($vEvent);
        $vFile = $vCalendar->render();

        $url = route('meetings.show', $this->meeting->id);
        $url = getDomainSpecificUrl($url, $this->company);


        $content = '<h2 style="color: ' . $this->company->header_color . ';"> ' . __('performance::email.meeting.meetingInvitation') . '</h2>'
            . '<p> ' . __('performance::email.meeting.youHaveBeenInvited'). '</p>'
            . '<p> <strong>' . __('performance::app.meetingDate') . ':</strong> ' . $this->meeting->start_date_time->translatedFormat($this->company->date_format) . '</p>'
            . '<p> <strong>' . __('performance::email.meeting.startTime') . ':</strong> ' . $this->meeting->start_date_time->translatedFormat($this->company->date_format . ' - ' . $this->company->time_format) . '</p>'
            . '<p> <strong>' . __('performance::email.meeting.endTime') . ':</strong> ' . $this->meeting->end_date_time->translatedFormat($this->company->date_format . ' - ' . $this->company->time_format) . '</p>'
            . '<p> <strong>' . __('performance::app.meetingBy') . ':</strong> ' . $this->meeting->meetingBy->name . '</p>'
            . '<p> <strong>' . __('performance::app.meetingFor') . ':</strong> ' . $this->meeting->meetingFor->name . '</p>'
            . '<p> <strong>' . __('app.status') . ':</strong> ' . __('performance::app.' . $this->meeting->status) . '</p>';

        $meetingInvite->subject(__('performance::email.meeting.subject'))
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $content,
                'themeColor' => $this->company->header_color,
                'actionText' => __('performance::email.meeting.viewMeeting'),
                'notifiableName' => $notifiable->name
            ]);

        $meetingInvite->attachData($vFile, 'cal.ics', [
            'mime' => 'text/calendar',
        ]);

        return $meetingInvite;
    }

    /**
     * Get the array representation of the notification.
     *
     * @param mixed $notifiable
     * @return array
     */
    //phpcs:ignore
    public function toArray($notifiable)
    {
        return [
            'id' => $this->meeting->id,
            'heading' => __('performance::email.meeting.youHaveBeenInvited'),
        ];
    }

    public function toSlack($notifiable)
    {
        $url = route('meetings.show', $this->meeting->id);

        $statusEmoji = $this->meeting->status == 'pending' ? '🕒 ' : '✅ ';

        // Build the Slack message content
        return $this->slackBuild($notifiable)
            ->content(
                __('performance::email.meeting.meetingInvitation') . "\n\n" .
                __('performance::email.meeting.youHaveBeenInvited') . "\n\n" .
                __('performance::app.meetingDate') . ': ' . $this->meeting->start_date_time->translatedFormat($this->company->date_format) . "\n" .
                __('performance::email.meeting.startTime') . ': ' . $this->meeting->start_date_time->translatedFormat($this->company->date_format . ' - ' . $this->company->time_format) . "\n" .
                __('performance::email.meeting.endTime') . ': ' . $this->meeting->end_date_time->translatedFormat($this->company->date_format . ' - ' . $this->company->time_format) . "\n\n" .
                __('performance::app.meetingBy') . ': ' . $this->meeting->meetingBy->name . "\n\n" .
                __('performance::app.meetingFor') . ': ' . $this->meeting->meetingFor->name . "\n\n" .
                $statusEmoji . ' *' . __('app.status') . ':* ' . __('performance::app.' . $this->meeting->status) . "\n\n" .
                "<$url|". __('performance::email.meeting.viewMeeting') .">"
            );
    }

    public function toOneSignal()
    {
        return OneSignalMessage::create()
            ->setSubject(__('performance::email.meeting.subject'))
            ->setBody(__('performance::email.meeting.youHaveBeenInvited'));
    }

}
