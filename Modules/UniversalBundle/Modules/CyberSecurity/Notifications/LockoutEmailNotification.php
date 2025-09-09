<?php

namespace Modules\CyberSecurity\Notifications;

use App\Notifications\BaseNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;

class LockoutEmailNotification extends BaseNotification
{
    use Queueable;

    public $email;
    public $ip;

    /**
     * Create a new notification instance.
     */
    public function __construct($event)
    {
        $this->email = $event->email;
        $this->ip = $event->ip;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param mixed $notifiable
     * @return array
     */
    // phpcs:ignore
    public function via($notifiable)
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     *
     * @param mixed $notifiable
     * @return MailMessage
     */
    // phpcs:ignore
    public function toMail($notifiable): MailMessage
    {
        $build = parent::build();
        $content = __('cybersecurity::email.lockout.content', [
            'email' => $this->email,
            'ip' => $this->ip,
        ]);

        return $build
            ->subject(__('cybersecurity::email.lockout.subject'))
            ->markdown('mail.email', [
                'content' => $content,
            ]);
    }

}
