<?php

namespace App\Notifications;

use App\Models\PropertyAvailabilityRequest;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;

class AvailabilityRequested extends BaseNotification
{
    private PropertyAvailabilityRequest $availabilityRequest;

    public function __construct(PropertyAvailabilityRequest $availabilityRequest)
    {
        $this->availabilityRequest = $availabilityRequest->load(['property', 'requestingAgent']);
        $this->company = $availabilityRequest->property->company ?? null;
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $build = $this->build($notifiable);
        $property = $this->availabilityRequest->property;
        $requestingAgent = $this->availabilityRequest->requestingAgent;

        // Generate signed URLs for quick approve/deny from email
        $approveUrl = URL::signedRoute('availability-requests.respond-email', [
            'id' => $this->availabilityRequest->id,
            'action' => 'approve',
        ]);
        $denyUrl = URL::signedRoute('availability-requests.respond-email', [
            'id' => $this->availabilityRequest->id,
            'action' => 'deny',
        ]);

        return $build
            ->subject("Availability Check: {$property->display_title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$requestingAgent->name} is requesting to check the availability of a property you manage.")
            ->line("**Property:** {$property->display_title}")
            ->line("**Reference:** {$property->reference_code}")
            ->line("**Location:** " . ($property->city ? "{$property->city}, {$property->area}" : 'N/A'))
            ->when($this->availabilityRequest->message, function ($mail) {
                $mail->line("**Agent's Message:** {$this->availabilityRequest->message}");
            })
            ->line('')
            ->line('Please respond within 8 business hours. If no response is given, this request will be escalated to admin.')
            ->action('Approve Request', $approveUrl)
            ->line("[Deny Request]({$denyUrl})")
            ->line('')
            ->line('You can also respond from the availability requests page in the CRM.');
    }

    public function toArray($notifiable): array
    {
        $property = $this->availabilityRequest->property;
        $requestingAgent = $this->availabilityRequest->requestingAgent;

        return [
            'type' => 'availability_requested',
            'availability_request_id' => $this->availabilityRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_agent_id' => $requestingAgent->id,
            'requesting_agent_name' => $requestingAgent->name,
            'message' => $this->availabilityRequest->message,
            'icon' => 'home',
            'heading' => 'Availability Check Requested',
            'description' => "{$requestingAgent->name} requests availability check for {$property->display_title}",
        ];
    }
}
