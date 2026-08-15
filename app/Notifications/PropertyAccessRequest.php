<?php

namespace App\Notifications;

use App\Models\Property;
use App\Models\User;
use App\Support\PropertyRequestMailPresenter;
use Illuminate\Notifications\Messages\MailMessage;

class PropertyAccessRequest extends BaseNotification
{
    private Property $property;

    private User $requestingUser;

    private string $requestType;

    private string $message;

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
        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $build = $this->build($notifiable);

        $typeLabel = $this->requestType === 'viewing' ? 'property viewing' : 'property sale';
        $subject = "Property Access Request: {$this->property->display_title}";
        $introText = "{$this->requestingUser->name} has requested access for a {$typeLabel}.";
        $contentHtml = PropertyRequestMailPresenter::joinBlocks(
            PropertyRequestMailPresenter::propertyMeta($this->property, false),
            PropertyRequestMailPresenter::line('Request Type', ucfirst($this->requestType)),
            PropertyRequestMailPresenter::line('Message', $this->message),
            'Please respond to this request at your earliest convenience.',
        );
        $actionUrl = $this->modifyUrl(route('properties.show', $this->property->id));

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.property.request', [
                'subject' => $subject,
                'badgeLabel' => 'Property Access',
                'notifiableName' => $notifiable->name,
                'introText' => $introText,
                'content' => $contentHtml,
                'actionDescription' => 'View the property details below.',
                'actionText' => 'View Property',
                'url' => $actionUrl,
            ]);

        $this->attachPropertyRequestPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Property Access',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $contentHtml,
            'actionDescription' => 'View the property details below.',
            'actionText' => 'View Property',
            'entityUrl' => $actionUrl,
            'footerNote' => '',
        ]);

        parent::resetLocale();

        return $build;
    }

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
