<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class MeetingSummaryNotification extends Notification
{
    use Queueable;

    protected $meetingSummary;
    protected $dealFollowUp;
    protected $deal;
    protected $action;

    /**
     * Create a new notification instance.
     */
    public function __construct($meetingSummary, $dealFollowUp, $deal, $action = 'created')
    {
        $this->meetingSummary = $meetingSummary;
        $this->dealFollowUp = $dealFollowUp;
        $this->deal = $deal;
        $this->action = $action;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $subject = $this->action === 'created' 
            ? 'New Meeting Summary Available' 
            : 'Meeting Summary Updated';
            
        $summaryLink = url('/deals/' . $this->deal->id . '/meeting-summary/' . $this->meetingSummary->id);
        
        $mailMessage = (new MailMessage)
                    ->subject($subject)
                    ->greeting('Hello ' . $notifiable->name . '!')
                    ->line('A meeting summary has been ' . $this->action . ' for the following deal:')
                    ->line('**Deal:** ' . $this->deal->name);
        
        // Safely format meeting date
        if ($this->dealFollowUp->next_follow_up_date) {
            $mailMessage->line('**Meeting Date:** ' . $this->dealFollowUp->next_follow_up_date->format('M d, Y H:i'));
        } else {
            $mailMessage->line('**Meeting Date:** Not specified');
        }
        
        // Safely format platform
        if ($this->dealFollowUp->location) {
            $mailMessage->line('**Platform:** ' . ucfirst($this->dealFollowUp->location));
        } else {
            $mailMessage->line('**Platform:** Not specified');
        }
        
        return $mailMessage
                    ->line('Click the button below to view the meeting summary:')
                    ->action('View Meeting Summary', $summaryLink)
                    ->line('Thank you for using our CRM system!');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            //
        ];
    }
}
