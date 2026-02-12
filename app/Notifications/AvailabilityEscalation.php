<?php

namespace App\Notifications;

use App\Models\PropertyAvailabilityRequest;
use Illuminate\Notifications\Messages\MailMessage;

class AvailabilityEscalation extends BaseNotification
{
    private PropertyAvailabilityRequest $availabilityRequest;

    public function __construct(PropertyAvailabilityRequest $availabilityRequest)
    {
        $this->availabilityRequest = $availabilityRequest->load(['property', 'requestingAgent', 'responsibleAgent']);
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
        $responsibleAgent = $this->availabilityRequest->responsibleAgent;

        return $build
            ->subject("ESCALATION: Availability Request Overdue - {$property->display_title}")
            ->greeting("Hello {$notifiable->name},")
            ->line('An availability request has not been responded to within the required 8 business hours and requires your attention.')
            ->line('')
            ->line("**Property:** {$property->display_title}")
            ->line("**Reference:** {$property->reference_code}")
            ->line("**Requesting Agent:** {$requestingAgent->name}")
            ->line("**Responsible Agent:** {$responsibleAgent->name}")
            ->line("**Requested At:** {$this->availabilityRequest->created_at->format('M d, Y H:i')}")
            ->line("**Escalated At:** {$this->availabilityRequest->escalated_at->format('M d, Y H:i')}")
            ->when($this->availabilityRequest->message, function ($mail) {
                $mail->line("**Original Message:** {$this->availabilityRequest->message}");
            })
            ->line('')
            ->line('Please review and respond to this request as an administrator.')
            ->action('View Request', url("/account/availability-requests/{$this->availabilityRequest->id}"));
    }

    public function toArray($notifiable): array
    {
        $property = $this->availabilityRequest->property;
        $requestingAgent = $this->availabilityRequest->requestingAgent;
        $responsibleAgent = $this->availabilityRequest->responsibleAgent;

        return [
            'type' => 'availability_escalation',
            'availability_request_id' => $this->availabilityRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_agent_id' => $requestingAgent->id,
            'requesting_agent_name' => $requestingAgent->name,
            'responsible_agent_id' => $responsibleAgent->id,
            'responsible_agent_name' => $responsibleAgent->name,
            'icon' => 'alert-triangle',
            'heading' => 'Availability Request Escalated',
            'description' => "Overdue availability request for {$property->display_title} by {$requestingAgent->name} (assigned to {$responsibleAgent->name})",
        ];
    }
}
