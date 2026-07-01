<?php

namespace App\Notifications;

use App\Models\PropertyPublishRequest;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Sent to all Sales Managers when an agent submits a publish request.
 */
class PublishRequestSubmitted extends BaseNotification
{
    private PropertyPublishRequest $publishRequest;

    public function __construct(PropertyPublishRequest $publishRequest)
    {
        $this->publishRequest = $publishRequest;
        $this->company = $publishRequest->property?->company ?? null;
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $property = $this->publishRequest->property;
        $agent = $this->publishRequest->requestingAgent;

        $build = $this->build($notifiable);

        return $build
            ->subject("Publish Request: {$property->display_title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$agent->name} has requested to publish a property.")
            ->line("**Property:** {$property->display_title}")
            ->line("**Reference Code:** {$property->reference_code}")
            ->when($this->publishRequest->message, function ($mail) {
                return $mail->line("**Agent's Note:** {$this->publishRequest->message}");
            })
            ->action('Review Publish Requests', $this->modifyUrl(route('publish-requests.index')))
            ->line('Please review and approve or reject this request.');
    }

    public function toArray($notifiable): array
    {
        $property = $this->publishRequest->property;
        $agent = $this->publishRequest->requestingAgent;

        return [
            'type' => 'publish_request_submitted',
            'publish_request_id' => $this->publishRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_user_id' => $agent->id,
            'requesting_user_name' => $agent->name,
            'icon' => 'global',
            'heading' => 'New Publish Request',
            'description' => "{$agent->name} wants to publish: {$property->display_title}",
        ];
    }
}
