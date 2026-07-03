<?php

namespace App\Notifications;

use App\Models\PropertyAvailabilityRequest;
use Illuminate\Notifications\Messages\MailMessage;

class AvailabilityResponse extends BaseNotification
{
    private PropertyAvailabilityRequest $availabilityRequest;

    public function __construct(PropertyAvailabilityRequest $availabilityRequest)
    {
        $this->availabilityRequest = $availabilityRequest->load(['property', 'responsibleAgent']);
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
        $isApproved = $this->availabilityRequest->status === PropertyAvailabilityRequest::STATUS_APPROVED;
        $statusLabel = $isApproved ? 'Approved' : 'Denied';

        $mail = $build
            ->subject("Availability Request {$statusLabel}: {$property->display_title}")
            ->greeting("Hello {$notifiable->name},");

        if ($isApproved) {
            $mail->line("Great news! Your availability request for the following property has been **approved**.")
                ->line("**Property:** {$property->display_title}")
                ->line("**Reference:** {$property->reference_code}")
                ->line("**Location:** " . ($property->city ? "{$property->city}, {$property->area}" : 'N/A'));

            if ($this->availabilityRequest->response_message) {
                $mail->line("**Response Message:** {$this->availabilityRequest->response_message}");
            }

            $mail->line('')
                ->line('You may now proceed with presenting this property to your customer.')
                ->action('View Property', $this->modifyUrl(route('properties.show', $property->id)));
        } else {
            $mail->line("Your availability request for the following property has been **denied**.")
                ->line("**Property:** {$property->display_title}")
                ->line("**Reference:** {$property->reference_code}");

            if ($this->availabilityRequest->response_message) {
                $mail->line("**Reason:** {$this->availabilityRequest->response_message}");
            }

            $mail->line('')
                ->line('Please consider other properties for your customer.');
        }

        return $mail;
    }

    public function toArray($notifiable): array
    {
        $property = $this->availabilityRequest->property;
        $isApproved = $this->availabilityRequest->status === PropertyAvailabilityRequest::STATUS_APPROVED;

        return [
            'type' => 'availability_response',
            'availability_request_id' => $this->availabilityRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'status' => $this->availabilityRequest->status,
            'response_message' => $this->availabilityRequest->response_message,
            'icon' => $isApproved ? 'check-circle' : 'x-circle',
            'heading' => $isApproved ? 'Availability Request Approved' : 'Availability Request Denied',
            'description' => $isApproved
                ? "Your availability request for {$property->display_title} has been approved"
                : "Your availability request for {$property->display_title} has been denied",
        ];
    }
}
