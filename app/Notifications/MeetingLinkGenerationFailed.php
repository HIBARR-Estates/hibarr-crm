<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\DealFollowUp;
use App\Models\User;
use App\Support\UserTimezone;

class MeetingLinkGenerationFailed extends BaseNotification
{
    private $followUp;
    private $agent;
    private $errorMessage;
    private $emailSetting;

    public function __construct(DealFollowUp $followUp, User $agent, string $errorMessage)
    {
        $this->followUp = $followUp;
        $this->agent = $agent;
        $this->errorMessage = $errorMessage;
        $this->company = $followUp->deal->company ?? $agent->company;
        $this->emailSetting = EmailNotificationSetting::where('company_id', $this->company->id)
            ->where('slug', 'meeting-link-generation-failed')
            ->first();
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        $via = array('database');

        if ($this->emailSetting && $this->emailSetting->send_email == 'yes' && 
            $notifiable->email_notifications && $notifiable->email != '') {
            array_push($via, 'mail');
        }

        return $via;
    }

    /**
     * Get the mail representation of the notification.
     *
     * @param mixed $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);
        $url = route('deals.show', $this->followUp->deal_id);
        $url = getDomainSpecificUrl($url, $this->company);

        $meetingType = $this->followUp->meetingType ? $this->followUp->meetingType->name : 'N/A';
        $location = ucfirst(str_replace('_', ' ', $this->followUp->location));
        $timezone = UserTimezone::resolve(
            $notifiable instanceof User ? $notifiable : null,
            $this->company
        );
        $followUpDate = $this->followUp->next_follow_up_date
            ->copy()
            ->setTimezone($timezone)
            ->format('M d, Y \a\t g:i A');

        $content = __('email.meetingLinkGenerationFailed.subject') . '<br><br>' .
                   __('modules.lead.dealName') . ': ' . $this->followUp->deal->name . '<br>' .
                   __('modules.lead.meetingType') . ': ' . $meetingType . '<br>' .
                   __('modules.lead.location') . ': ' . $location . '<br>' .
                   __('modules.lead.nextFollowUp') . ': ' . $followUpDate . '<br>' .
                   __('email.meetingLinkGenerationFailed.error') . ': ' . $this->errorMessage . '<br><br>' .
                   __('email.meetingLinkGenerationFailed.actionRequired');

        $build
            ->subject(__('email.meetingLinkGenerationFailed.subject') . ' - ' . config('app.name'))
            ->markdown('mail.email', [
                'url' => $url,
                'content' => $content,
                'themeColor' => $this->company->header_color,
                'actionText' => __('email.meetingLinkGenerationFailed.action'),
                'notifiableName' => $notifiable->name
            ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * Get the array representation of the notification.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function toArray($notifiable)
    {
        return [
            'follow_up_id' => $this->followUp->id,
            'deal_id' => $this->followUp->deal_id,
            'deal_name' => $this->followUp->deal->name,
            'meeting_type' => $this->followUp->meetingType ? $this->followUp->meetingType->name : 'N/A',
            'location' => $this->followUp->location,
            'follow_up_date' => $this->followUp->next_follow_up_date->format('Y-m-d H:i:s'),
            'error_message' => $this->errorMessage,
            'agent_id' => $notifiable->id,
            'added_by' => $this->followUp->added_by
        ];
    }
}
