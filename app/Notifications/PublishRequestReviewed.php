<?php

namespace App\Notifications;

use App\Models\PropertyPublishRequest;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Sent to the requesting agent when a Sales Manager approves or rejects their publish request.
 */
class PublishRequestReviewed extends BaseNotification
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
        $reviewer = $this->publishRequest->reviewer;
        $isApproved = $this->publishRequest->isApproved();
        $status = $isApproved ? 'Approved' : 'Rejected';

        $build = $this->build($notifiable);

        $mail = $build
            ->subject("Publish Request {$status}: {$property->display_title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("Your publish request has been **{$status}**.")
            ->line("**Property:** {$property->display_title}")
            ->line("**Reference Code:** {$property->reference_code}")
            ->line("**Reviewed by:** {$reviewer->name}");

        if ($this->publishRequest->response_message) {
            $mail->line("**Reviewer's Note:** {$this->publishRequest->response_message}");
        }

        if ($isApproved) {
            $mail->line('Your property is now published and visible to the public.')
                ->action('View Property', url("/account/properties/{$property->id}"));
        } else {
            $mail->line('Please review the feedback and update your property before requesting again.')
                ->action('View Property', url("/account/properties/{$property->id}"));
        }

        return $mail;
    }

    public function toArray($notifiable): array
    {
        $property = $this->publishRequest->property;
        $reviewer = $this->publishRequest->reviewer;
        $isApproved = $this->publishRequest->isApproved();
        $status = $isApproved ? 'approved' : 'rejected';

        return [
            'type' => 'publish_request_reviewed',
            'publish_request_id' => $this->publishRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'reviewer_id' => $reviewer->id,
            'reviewer_name' => $reviewer->name,
            'result' => $status,
            'response_message' => $this->publishRequest->response_message,
            'icon' => $isApproved ? 'check-circle' : 'close-circle',
            'heading' => 'Publish Request ' . ucfirst($status),
            'description' => "Your property \"{$property->display_title}\" was {$status} by {$reviewer->name}.",
        ];
    }
}
