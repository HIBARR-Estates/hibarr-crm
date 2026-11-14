<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * A new partner account was created for this person.
 *
 * Sign-in is Keycloak SSO only and the local password is random and never
 * shared. When Keycloak provisioning is on, enrolment (set password) is sent
 * separately by the identity provider; this mail is the CRM welcome.
 */
class PartnerInvited extends BaseNotification
{
    private bool $provisioned;

    public function __construct(User $user, private string $invitedByName)
    {
        $this->company = $user->company;
        $this->provisioned = \App\Services\PartnerInviteService::enabled();
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $url = getDomainSpecificUrl(route('login'), $this->company);

        $mail = $this->build($notifiable)
            ->subject('You have been invited as a partner on '.config('app.name'))
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->invitedByName} has set you up as a referral partner.");

        if ($this->provisioned) {
            $mail->line('You will receive a separate email to set your password. After that, sign in with single sign-on using this address: **'.$notifiable->email.'**');
        } else {
            $mail->line("Sign in with single sign-on using this email address: **{$notifiable->email}**");
        }

        return $mail
            ->line('Once in, you will see the leads you refer and the commission they earn.')
            ->action('Sign in', $url);
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'partner_invited',
            'user_id' => $notifiable->id,
        ];
    }
}
