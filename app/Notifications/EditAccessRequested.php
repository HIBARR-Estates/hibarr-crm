<?php

namespace App\Notifications;

use App\Models\PropertyEditAccessRequest;
use Illuminate\Notifications\Messages\MailMessage;

class EditAccessRequested extends BaseNotification
{
    private PropertyEditAccessRequest $editAccessRequest;

    public function __construct(PropertyEditAccessRequest $editAccessRequest)
    {
        $this->editAccessRequest = $editAccessRequest->load(['property', 'requestingAgent']);
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
        $requestingAgent = $this->editAccessRequest->requestingAgent;

        return $build
            ->subject("Edit Access Request: {$property->display_title}")
            ->greeting("Hello {$notifiable->name},")
            ->line("{$requestingAgent->name} is requesting edit access to a property you manage.")
            ->line("**Property:** {$property->display_title}")
            ->line("**Reference:** {$property->reference_code}")
            ->when($this->editAccessRequest->message, function ($mail) {
                $mail->line("**Agent's Message:** {$this->editAccessRequest->message}");
            })
            ->action('Review Request', $this->modifyUrl(route('edit-access-requests.index')))
            ->line('Approve to grant the agent collaborator access to update public listing fields.');
    }

    public function toArray($notifiable): array
    {
        $property = $this->editAccessRequest->property;
        $requestingAgent = $this->editAccessRequest->requestingAgent;

        return [
            'type' => 'edit_access_requested',
            'edit_access_request_id' => $this->editAccessRequest->id,
            'property_id' => $property->id,
            'property_reference' => $property->reference_code,
            'property_title' => $property->display_title,
            'requesting_agent_id' => $requestingAgent->id,
            'requesting_agent_name' => $requestingAgent->name,
            'message' => $this->editAccessRequest->message,
            'icon' => 'edit',
            'heading' => 'Edit Access Requested',
            'description' => "{$requestingAgent->name} requests edit access for {$property->display_title}",
        ];
    }
}
