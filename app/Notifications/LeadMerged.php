<?php

namespace App\Notifications;

use App\Models\EmailNotificationSetting;
use App\Models\Lead;
use App\Models\User;
use App\Scopes\ActiveScope;

/**
 * Sent to the owners of both leads when a duplicate lead is merged into
 * another. Replaces the "Lead removed from pipeline" notice a merge used to
 * trigger, and says where the lead and its records went.
 */
class LeadMerged extends BaseNotification
{
    private int $keptLeadId;

    private string $keptLeadName;

    private string $duplicateName;

    private string $mergedByName;

    private ?int $mergedById;

    private ?string $keptOwnerName;

    private ?int $keptOwnerId;

    private ?EmailNotificationSetting $emailSetting;

    public function __construct(Lead $kept, Lead $duplicate, ?User $mergedBy = null)
    {
        $this->company = $kept->company;
        $this->keptLeadId = (int) $kept->id;
        $this->keptLeadName = trim((string) ($kept->client_name ?? '')) ?: __('modules.lead.lead');
        $this->duplicateName = trim((string) ($duplicate->client_name ?? '')) ?: __('modules.lead.lead');
        $this->mergedById = $mergedBy?->id;
        $this->mergedByName = trim((string) ($mergedBy?->name ?? '')) ?: __('email.leadMerged.unknownActor');
        $this->keptOwnerId = $kept->lead_owner !== null ? (int) $kept->lead_owner : null;
        // Not through the leadOwner relation: its ActiveScope would drop a
        // deactivated owner's name from the notice.
        $this->keptOwnerName = $this->keptOwnerId !== null
            ? User::withoutGlobalScope(ActiveScope::class)->whereKey($this->keptOwnerId)->value('name')
            : null;
        $this->emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'lead-notification')
                ->first()
            : null;

        $this->initUnsRouting();
    }

    public function via($notifiable): array
    {
        $via = ['database'];

        if (
            $notifiable->status === 'active'
            && $this->emailSetting
            && $this->emailSetting->send_email === 'yes'
            && $notifiable->email_notifications
            && ! empty($notifiable->email)
        ) {
            $via[] = 'mail';
        }

        return $via;
    }

    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);
        $url = $this->leadUrl();

        $subject = __('email.leadMerged.subject');
        $bodyText = $this->bodyText($notifiable);
        $actionText = __('email.leadMerged.action');

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.lead.lead-merged', [
                'url' => $url,
                'bodyText' => $bodyText,
                'preheader' => $bodyText,
                'actionText' => $actionText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $bodyText,
            'badgeLabel' => $this->keptLeadName,
            'notifiableName' => $notifiable->name,
            'introText' => $bodyText,
            'detailHtml' => '',
            'contentHtml' => '',
            'actionDescription' => __('email.leadMerged.actionDescription'),
            'actionText' => $actionText,
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable): array
    {
        return [
            'id' => $this->keptLeadId,
            'lead_id' => $this->keptLeadId,
            'name' => $this->keptLeadName,
            'merged_by' => $this->mergedById,
            'merged_by_name' => $this->mergedByName,
            'title' => __('email.leadMerged.subject'),
            'text' => $this->bodyText($notifiable),
            'action_url' => $this->leadUrl(),
        ];
    }

    private function leadUrl(): string
    {
        return getDomainSpecificUrl(route('lead-contact.show', $this->keptLeadId), $this->company);
    }

    /**
     * "<duplicate> was merged into <kept> by <actor>. Its notes, tasks, deals,
     * meetings and files are now on that lead." plus, for someone who does not
     * own the kept lead, who does.
     */
    private function bodyText($notifiable): string
    {
        $text = __('email.leadMerged.text', [
            'duplicate' => $this->duplicateName,
            'kept' => $this->keptLeadName,
            'mergedBy' => $this->mergedByName,
        ]);

        $notifiableId = isset($notifiable->id) ? (int) $notifiable->id : null;
        if ($this->keptOwnerId !== null && $notifiableId !== $this->keptOwnerId && $this->keptOwnerName) {
            $text .= ' '.__('email.leadMerged.ownerLine', ['owner' => $this->keptOwnerName]);
        } elseif ($this->keptOwnerId !== null && $notifiableId === $this->keptOwnerId) {
            $text .= ' '.__('email.leadMerged.youOwnLine');
        }

        return $text;
    }
}
