<?php

namespace App\Notifications;

use App\Models\CommunicationActivity;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class NewCommunicationActivity extends Notification implements ShouldQueue
{
    use Queueable;

    protected $activity;
    protected $dealOrLead;

    /**
     * Create a new notification instance.
     */
    public function __construct(CommunicationActivity $activity, $dealOrLead)
    {
        $this->activity = $activity;
        $this->dealOrLead = $dealOrLead;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via($notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail($notifiable): MailMessage
    {
        $entityType = $this->activity->deal_id ? 'Deal' : 'Lead';
        $entityName = $this->dealOrLead->name ?? $this->dealOrLead->client_name ?? 'Unknown';
        $channelType = ucfirst($this->activity->channel_type);
        $senderName = $this->activity->sender_name;

        $messagePreview = substr((string) $this->activity->message_content, 0, 100);
        $messagePreview .= (strlen((string) $this->activity->message_content) > 100 ? '...' : '');

        return (new MailMessage)
            ->subject("New {$channelType} Communication - {$entityType}: {$entityName}")
            ->greeting("Hello {$notifiable->name},")
            ->line("A new {$channelType} communication has been recorded for {$entityType}: {$entityName}")
            ->line("From: {$senderName}")
            ->line("Message: {$messagePreview}")
            ->line("Time: " . $this->activity->timestamp->format('M d, Y H:i'))
            ->action('View Details', $this->getActionUrl())
            ->line('Thank you for using our application!');
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray($notifiable): array
    {
        $entityType = $this->activity->deal_id ? 'Deal' : 'Lead';
        $entityName = $this->dealOrLead->name ?? $this->dealOrLead->client_name ?? 'Unknown';

        return [
            'id' => $this->activity->id,
            'type' => 'communication_activity',
            'entity_type' => $entityType,
            'entity_name' => $entityName,
            'channel_type' => $this->activity->channel_type,
            'sender_name' => $this->activity->sender_name,
            'message_preview' => substr((string) $this->activity->message_content, 0, 100),
            'timestamp' => $this->activity->timestamp->toISOString(),
            'action_url' => $this->getActionUrl(),
        ];
    }

    /**
     * Get the action URL for the notification.
     */
    private function getActionUrl(): string
    {
        if ($this->activity->deal_id) {
            return route('deals.show', $this->activity->deal_id);
        } else {
            return route('leads.show', $this->activity->lead_id);
        }
    }
} 