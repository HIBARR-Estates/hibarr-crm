<?php

namespace App\Notifications;

use App\Models\PropertyEditAccessRequest;
use Illuminate\Notifications\Messages\MailMessage;

class EditAccessReviewed extends BaseNotification
{
    private PropertyEditAccessRequest $editAccessRequest;

    public function __construct(PropertyEditAccessRequest $editAccessRequest)
    {
        $this->editAccessRequest = $editAccessRequest->load(['property', 'responsibleAgent']);
        $this->company = $editAccessRequest->property->company ?? null;
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $build = $this->build($notifiable);
        $property = $this->editAccessRequest->property;
        $isApproved = $this->editAccessRequest->status === PropertyEditAccessRequest::STATUS_APPROVED;
        $statusLabel = $isApproved ? 'Approved' : 'Denied';

        $mail = $build
            ->subject("Edit Access {$statusLabel}: {$property->display_title}")
            ->greeting("Hello {$notifiable->name},");

        if ($isApproved) {
            $mail->line('Your edit access request has been **approved**.')
                ->line("**Property:** {$property->display_title}")
                ->line("**Reference:** {$property->reference_code}")
                ->line('You can now edit public listing fields and manage assets on this property.');

            if ($this->editAccessRequest->response_message) {
                $mail->line("**Response Message:** {$this->editAccessRequest->response_message}");
            }

            $mail->action('Edit Property', $this->modifyUrl(route('properties.show', $property->id)));
        } else {
            $mail->line('Your edit access request has been **denied**.')
                ->line("**Property:** {$property->display_title}")
                ->line("**Reference:** {$property->reference_code}");

            if ($this->editAccessRequest->response_message) {
                $mail->line("**Reason:** {$this->editAccessRequest->response_message}");
            }
        }

        return $mail;
    }

    public function toArray($notifiable): array
    {
        $property = $this->editAccessRequest->property;
        $isApproved = $this->editAccessRequest->status === PropertyEditAccessRequest::STATUS_APPROVED;

        return [
            'type' => 'edit_access_reviewed',
            'edit_access_request_id' => $this->editAccessRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'status' => $this->editAccessRequest->status,
            'response_message' => $this->editAccessRequest->response_message,
            'icon' => $isApproved ? 'check-circle' : 'x-circle',
            'heading' => $isApproved ? 'Edit Access Approved' : 'Edit Access Denied',
            'description' => $isApproved
                ? "You can now edit {$property->display_title}"
                : "Your edit access request for {$property->display_title} was denied",
        ];
    }
}
