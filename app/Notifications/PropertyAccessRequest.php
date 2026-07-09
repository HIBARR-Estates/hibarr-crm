<?php

namespace App\Notifications;

use App\Models\Property;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;

class PropertyAccessRequest extends BaseNotification
{
    private Property $property;
    private User $requestingUser;
    private string $requestType;
    private string $message;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        Property $property,
        User $requestingUser,
        string $requestType,
        string $message
    ) {
        $this->property = $property;
        $this->requestingUser = $requestingUser;
        $this->requestType = $requestType;
        $this->message = $message;
        $this->company = $property->company ?? null;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail($notifiable): MailMessage
    {
        $build = $this->build($notifiable);
        
        $typeLabel = $this->requestType === 'viewing' ? 'property viewing' : 'property sale';
        
        return $build
            ->subject("Property Access Request: {$this->property->display_title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->requestingUser->name} has requested access for a {$typeLabel}.")
            ->line("**Property:** {$this->property->display_title}")
            ->line("**Reference Code:** {$this->property->reference_code}")
            ->line("**Request Type:** " . ucfirst($this->requestType))
            ->line("**Message:**")
            ->line($this->message)
            ->action('View Property', $this->modifyUrl(route('properties.show', $this->property->id)))
            ->line('Please respond to this request at your earliest convenience.');
    }

    /**
     * Get the array representation of the notification.
     */
    public function toArray($notifiable): array
    {
        return [
            'type' => 'property_access_request',
            'property_id' => $this->property->id,
            'property_reference' => $this->property->reference_code,
            'property_title' => $this->property->display_title,
            'requesting_user_id' => $this->requestingUser->id,
            'requesting_user_name' => $this->requestingUser->name,
            'request_type' => $this->requestType,
            'message' => $this->message,
            'icon' => 'home',
            'heading' => 'Property Access Request',
            'description' => "{$this->requestingUser->name} requests access for {$this->requestType}: {$this->property->display_title}",
        ];
    }
}
