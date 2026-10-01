<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * A new partner account was created for this person.
 *
 * Sign-in is Keycloak SSO only and the local password is random and never
 * shared, so there is nothing to put in this mail but the address to sign in
 * with. That address has to match the one the account was created under, and
 * it has to be verified at the identity provider (LoginController only links an
 * unseen identity by email when the provider asserts email_verified).
 */
class PartnerInvited extends BaseNotification
{
    public function __construct(User $user, private string $invitedByName)
    {
        $this->company = $user->company;
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $url = getDomainSpecificUrl(route('login'), $this->company);

        return $this->build($notifiable)
            ->subject('You have been invited as a partner on '.config('app.name'))
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->invitedByName} has set you up as a referral partner.")
            ->line("Sign in with single sign-on using this email address: **{$notifiable->email}**")
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
