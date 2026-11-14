<?php

namespace App\Notifications;

use App\Models\PartnerFlag;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * The partner team answered a flag. Goes to the partner who raised it.
 *
 * The client name stays off the mail and the in-app copy: the partner already
 * has the abbreviated name on their dashboard, and the notification travels
 * further than that screen does.
 */
class PartnerFlagAnswered extends PartnerFlagRaised
{
    public function __construct(PartnerFlag $flag)
    {
        parent::__construct($flag);
    }

    public function toMail($notifiable): MailMessage
    {
        return $this->build($notifiable)
            ->subject('Reply to your referral flag')
            ->greeting("Hello {$notifiable->name},")
            ->line('The partner team replied to a flag you raised.')
            ->line('**Reason:** '.$this->reasonLabel())
            ->line('**Reply:** '.$this->flag->response)
            ->action(
                'Open your dashboard',
                $this->modifyUrl(route('dashboard.v2', ['view' => 'partner']))
            );
    }

    public function toArray($notifiable): array
    {
        $description = 'The partner team replied: '.$this->flag->response;

        return [
            'type' => 'partner_flag_answered',
            'partner_flag_id' => $this->flag->id,
            'lead_id' => $this->flag->lead_id,
            'reason' => $this->flag->reason,
            'response' => $this->flag->response,
            'icon' => 'flag',
            'title' => 'Reply to your referral flag',
            'text' => $description,
            'heading' => 'Reply to your referral flag',
            'description' => $description,
            'action_url' => $this->modifyUrl(route('dashboard.v2', ['view' => 'partner'])),
        ];
    }
}
