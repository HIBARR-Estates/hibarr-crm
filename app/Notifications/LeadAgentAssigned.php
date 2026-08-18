<?php

namespace App\Notifications;

use App\Models\Deal;
use App\Models\EmailNotificationSetting;

class LeadAgentAssigned extends BaseNotification
{
    /**
     * Create a new notification instance.
     *
     * @return void
     */
    private $deal;

    private $emailSetting;

    private string $assignedByName;

    private string $assignedAt;

    public function __construct(Deal $deal)
    {
        $this->deal = $deal;
        $this->deal->loadMissing(['leadAgent', 'dealWatchers', 'contact', 'company', 'leadSource']);
        $this->company = $this->deal->company;
        $this->assignedByName = $this->safeMailText(user()?->name ?? __('app.system'), 100);
        $this->assignedAt = now()->format($this->company->date_format);
        $this->emailSetting = EmailNotificationSetting::where('company_id', $this->company->id)->where('slug', 'lead-notification')->first();
        $this->captureTriggeredByUser();
        $this->initUnsRouting();
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param  mixed  $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        // Never notify the person who created/assigned (including admins in allAdmins).
        if ($this->isTriggeredByNotifiable($notifiable)) {
            return [];
        }

        $via = ['database'];

        // During bulk updates, suppress individual transactional emails.
        if ($this->suppressBulkTransactionalEmails) {
            return $via;
        }

        // Check if email setting exists and is enabled
        if ($this->emailSetting && $this->emailSetting->send_email == 'yes' && $notifiable->email_notifications && $notifiable->email != '') {
            $via[] = 'mail';
        }

        return $via;
    }

    /**
     * Get the mail representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail($notifiable)
    {
        $build = parent::build($notifiable);

        $dealUrl = getDomainSpecificUrl(route('deals.show', $this->deal->id), $this->company);
        $leadUrl = $this->deal->lead_id
            ? getDomainSpecificUrl(route('lead-contact.show', $this->deal->lead_id), $this->company)
            : $dealUrl;

        $role = $this->resolveAssignmentRole($notifiable);
        $subject = $this->assignmentTitle($role);
        $introText = $this->assignmentIntro($role);
        $preheader = $this->safePreheader($introText);
        $actionText = $this->assignmentAction($role);
        $entityUrl = $this->assignmentEntityUrl($role, $leadUrl, $dealUrl);
        $footerNote = $this->capitalizeSentences($this->assignmentFooter($role));

        $contact = $this->deal->contact;
        $leadName = $this->safeMailText($contact?->client_name ?? $contact?->client_name_salutation ?? '', 200);
        $leadEmail = $this->safeMailText($contact?->client_email ?? '', 320);
        $dealName = $this->safeMailText($this->deal->name ?? '', 200);

        $leadEmailLabel = __('modules.lead.clientEmail').': ';
        $clientEmail = $leadEmail !== '' ? $leadEmailLabel : '';
        $content = $subject.'<br>'.__('modules.deal.dealName').': '.$dealName.'<br>'.__('modules.lead.clientName').': '.$leadName.'<br>'.$clientEmail.$leadEmail;

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.deal-assigned', [
                'url' => $entityUrl,
                'content' => $content,
                'preheader' => $preheader,
                'intro' => $introText,
                'themeColor' => $this->company->header_color,
                'actionText' => $actionText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachPlunkTemplate($build, '336e4f34-69bf-4a4f-92af-96e318a80548', [
            'preheader' => $preheader,
            'introText' => $introText,
            'assignedByName' => $this->assignedByName,
            'leadName' => $leadName,
            'leadEmail' => $leadEmail,
            'dealName' => $dealName,
            'assignedAt' => $this->assignedAt,
            'leadUrl' => $leadUrl,
            'dealUrl' => $dealUrl,
            'entityUrl' => $entityUrl,
            'actionText' => $actionText,
            'footerNote' => $footerNote,
            'assignmentRole' => $role,
        ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * Get the array representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return array
     */
    // phpcs:ignore
    public function toArray($notifiable)
    {
        $assignmentRole = $this->resolveAssignmentRole($notifiable);

        return [
            'id' => $this->deal->lead_id ?? $this->deal->id,
            'deal_id' => $this->deal->id,
            'lead_id' => $this->deal->lead_id,
            'name' => $this->safeMailText($this->deal->name ?? '', 200),
            'source' => $this->deal->leadSource?->name,
            'agent_id' => $notifiable->id,
            'added_by' => $this->deal->added_by,
            'assignment_role' => $assignmentRole,
            'title' => $this->assignmentTitle($assignmentRole),
            'text' => $this->safeMailText($this->assignmentIntro($assignmentRole), 240),
        ];
    }

    private function resolveAssignmentRole($notifiable): string
    {
        if ($this->deal->leadAgent && (int) $this->deal->leadAgent->user_id === (int) $notifiable->id) {
            return 'deal_agent';
        }

        if ($this->deal->dealWatchers->contains('id', $notifiable->id)) {
            return 'deal_watcher';
        }

        return 'new_deal';
    }

    private function assignmentTitle(string $assignmentRole): string
    {
        return match ($assignmentRole) {
            'deal_watcher' => __('email.dealWatcherAssigned.subject'),
            'new_deal' => __('email.newDealAwaitingAgent.subject'),
            default => __('email.leadAgentAssigned.subject'),
        };
    }

    private function assignmentIntro(string $assignmentRole): string
    {
        $by = $this->assignedByName;

        $base = match ($assignmentRole) {
            'deal_watcher' => __('email.dealWatcherAssigned.intro', ['name' => $by]),
            'new_deal' => __('email.newDealAwaitingAgent.intro', ['dealName' => $this->safeMailText($this->deal->name ?? '', 200)]),
            default => __('email.leadAgentAssigned.intro', ['name' => $by]),
        };

        $snippet = $this->aiSummarySnippet($this->deal);

        return $this->capitalizeSentences($snippet ?: $base);
    }

    private function assignmentFooter(string $assignmentRole): string
    {
        return match ($assignmentRole) {
            'deal_watcher' => __('email.dealWatcherAssigned.footer'),
            'new_deal' => __('email.newDealAwaitingAgent.footer'),
            default => __('email.leadAgentAssigned.footer'),
        };
    }

    private function assignmentEntityUrl(string $assignmentRole, string $leadUrl, string $dealUrl): string
    {
        return match ($assignmentRole) {
            'deal_watcher', 'new_deal' => $dealUrl,
            default => $leadUrl,
        };
    }

    private function assignmentAction(string $assignmentRole): string
    {
        return match ($assignmentRole) {
            'deal_watcher' => __('email.dealWatcherAssigned.action'),
            'new_deal' => __('email.newDealAwaitingAgent.action'),
            default => __('email.leadAgentAssigned.action'),
        };
    }
}
