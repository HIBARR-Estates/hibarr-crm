<?php

namespace App\Notifications;

use App\Models\PartnerFlag;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * A partner has flagged one of their referrals.
 *
 * Sent to everyone holding manage_partner_flags. The assigned agent is
 * deliberately not notified: the partner is escalating past them, and copying
 * them in turns a quiet nudge into a complaint.
 */
class PartnerFlagRaised extends BaseNotification
{
    private PartnerFlag $flag;

    public function __construct(PartnerFlag $flag)
    {
        $this->flag = $flag->load(['partner.user', 'lead']);
        $this->company = $flag->lead->company ?? null;
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        return $this->build($notifiable)
            ->subject('Partner flagged a referral')
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->partnerName()} has flagged a referral they introduced.")
            ->line('**Reason:** '.$this->reasonLabel())
            ->when($this->flag->message, function ($mail) {
                $mail->line("**Their message:** {$this->flag->message}");
            })
            ->action('Open the team dashboard', $this->modifyUrl(
                route('dashboard.v2', ['view' => 'manager'])
            ))
            // No client name in the mail body: it travels further than the
            // dashboard does, and the flag is about the handling, not the client.
            ->line('Open the dashboard to see which referral and respond.');
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'partner_flag_raised',
            'partner_flag_id' => $this->flag->id,
            'lead_id' => $this->flag->lead_id,
            'lead_agent_id' => $this->flag->lead_agent_id,
            'reason' => $this->flag->reason,
            'message' => $this->flag->message,
            'icon' => 'flag',
            'heading' => 'Partner flagged a referral',
            'description' => "{$this->partnerName()} flagged a referral: {$this->reasonLabel()}",
        ];
    }

    private function partnerName(): string
    {
        return $this->flag->partner?->user?->name ?? 'A partner';
    }

    private function reasonLabel(): string
    {
        return ucfirst(str_replace('_', ' ', $this->flag->reason));
    }
}
