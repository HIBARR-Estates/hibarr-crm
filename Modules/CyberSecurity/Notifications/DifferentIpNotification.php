<?php

namespace Modules\CyberSecurity\Notifications;

use App\Notifications\BaseNotification;
use Illuminate\Notifications\Messages\MailMessage;

class DifferentIpNotification extends BaseNotification
{

    public $user;
    public $ip;

    /**
     * Create a new notification instance.
     */
    public function __construct($event)
    {
        $this->user = $event->user;
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

        $content = __('cybersecurity::email.different_ip.content', [
            'email' => $this->user->email,
            'ip' => $this->ip,
        ]);

        return $build
            ->subject(__('cybersecurity::email.different_ip.subject'))
            ->markdown('mail.email', [
                'content' => $content,
            ]);
    }

}
