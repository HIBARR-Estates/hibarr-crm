<?php

namespace App\Notifications;

use App\Models\PropertyAvailabilityRequest;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;

class AvailabilityEscalationReminder extends BaseNotification
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

        $approveUrl = URL::signedRoute('availability-requests.respond-email', [
            'id' => $this->availabilityRequest->id,
            'action' => 'approve',
        ]);
        $denyUrl = URL::signedRoute('availability-requests.respond-email', [
            'id' => $this->availabilityRequest->id,
            'action' => 'deny',
        ]);

        return $build
            ->subject("REMINDER: Pending Availability Request - {$property->display_title}")
            ->greeting("Hello {$notifiable->name},")
            ->line('You have an availability request that has been pending for over 8 business hours and has been escalated to admin.')
            ->line('')
            ->line("**Property:** {$property->display_title}")
            ->line("**Reference:** {$property->reference_code}")
            ->line("**Requesting Agent:** {$requestingAgent->name}")
            ->line("**Requested At:** {$this->availabilityRequest->created_at->format('M d, Y H:i')}")
            ->line('')
            ->line('Please respond to this request as soon as possible.')
            ->action('Approve Request', $approveUrl)
            ->line("[Deny Request]({$denyUrl})");
    }

    public function toArray($notifiable): array
    {
        $property = $this->availabilityRequest->property;

        return [
            'type' => 'availability_escalation_reminder',
            'availability_request_id' => $this->availabilityRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'icon' => 'clock',
            'heading' => 'Overdue Availability Request',
            'description' => "Your availability request for {$property->display_title} is overdue and has been escalated",
        ];
    }
}
