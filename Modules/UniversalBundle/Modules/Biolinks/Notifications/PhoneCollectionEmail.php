<?php

namespace Modules\Biolinks\Notifications;

use App\Notifications\BaseNotification;

class PhoneCollectionEmail extends BaseNotification
{

    private $name;
    private $phone;

    /**
     * Create a new notification instance.
     */
    public function __construct($name, $phone)
    {
        $this->name = $name;
        $this->phone = $phone;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via($notifiable)
    {
        $via = [];

        if ($notifiable->email) {
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
        return parent::build()
            ->subject(__('biolinks::messages.newContactReceived') . ' - ' . __('biolinks::app.biolink') . '.')
            ->greeting(__('email.hello') . ' ' . $notifiable->name . ',')
            ->line(__('biolinks::messages.newContactReceived'))
            ->line(__('app.name') . ' : ' . $this->name)
            ->line(__('app.phone') . ' : ' . $this->phone);
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray($notifiable): array
    {
        return $notifiable->toArray();
    }

}
