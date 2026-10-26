<?php

namespace App\Email\Notifications;

use Illuminate\Notifications\Notification;

/**
 * Database row only. The agent is not emailed a copy of the customer's mail.
 */
class InboundMailNotification extends Notification
{
    public function __construct(
        public readonly string $copyId,
        public readonly string $sender,
        public readonly string $subject,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{sender: string, subject: string, title: string, text: string, action_url: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'sender' => $this->sender,
            'subject' => $this->subject,
            'title' => $this->sender,
            'text' => $this->subject,
            'action_url' => '/email/inbox?focus='.$this->copyId,
        ];
    }
}
