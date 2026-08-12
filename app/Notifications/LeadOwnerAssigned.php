<?php

namespace App\Notifications;

use App\Models\Company;
use App\Models\EmailNotificationSetting;
use App\Models\EntityAiSummary;
use App\Models\Lead;
use App\Models\User;
use App\Scopes\ActiveScope;

class LeadOwnerAssigned extends BaseNotification
{
    /**
     * Public scalars only — private typed props break when queued jobs are
     * unserialized after a class-shape change (seen as "$leadId must not be
     * accessed before initialization").
     */
    public int $leadId = 0;

    public string $leadName = '';

    public string $leadEmail = '';

    public ?int $previousOwnerId = null;

    public string $previousOwnerName = 'Unassigned';

    public string $assignedAt = '';

    public ?int $addedBy = null;

    public bool $shouldSendEmail = false;

    public ?int $companyId = null;

    public function __construct(Lead $lead, ?int $previousOwnerId = null)
    {
        // Keep only capped scalars — never the full Lead model. Queue workers
        // serialize notifications without SerializesModels; a bloated client_name
        // (or similar) on the Eloquent model will OOM the 128MB worker.
        $this->leadId = (int) $lead->id;
        $this->leadName = $this->safeMailText($lead->getAttributes()['client_name'] ?? $lead->client_name ?? '', 200);
        $this->leadEmail = $this->safeMailText($lead->getAttributes()['client_email'] ?? $lead->client_email ?? '', 320);
        $this->addedBy = $lead->added_by !== null ? (int) $lead->added_by : null;
        $this->previousOwnerId = $previousOwnerId;
        $this->previousOwnerName = $previousOwnerId
            ? (User::withoutGlobalScope(ActiveScope::class)->find($previousOwnerId)?->name ?? 'Unassigned')
            : 'Unassigned';

        $this->companyId = $lead->company_id !== null ? (int) $lead->company_id : null;
        $this->company = $this->resolveCompany();

        $this->assignedAt = now()->format($this->company?->date_format ?? 'Y-m-d');

        $emailSetting = $this->company
            ? EmailNotificationSetting::where('company_id', $this->company->id)
                ->where('slug', 'lead-notification')
                ->first()
            : null;
        $this->shouldSendEmail = $emailSetting?->send_email === 'yes';

        $this->initUnsRouting();
    }

    public function via($notifiable)
    {
        $via = ['database'];

        if (
            $notifiable->status === 'active' &&
            $this->shouldSendEmail &&
            $notifiable->email_notifications &&
            $notifiable->email !== ''
        ) {
            $via[] = 'mail';
        }

        return $via;
    }

    public function toMail($notifiable)
    {
        if ($this->leadId <= 0) {
            throw new \RuntimeException('LeadOwnerAssigned is missing leadId — discard stale queue payload.');
        }

        $this->company = $this->company ?? $this->resolveCompany();

        $build = parent::build($notifiable);
        $url = route('lead-contact.show', $this->leadId);
        $url = getDomainSpecificUrl($url, $this->company);

        $contentParts = [
            'A lead has been assigned to you.',
            __('modules.lead.clientName') . ': ' . $this->leadName,
        ];

        if ($this->leadEmail !== '') {
            $contentParts[] = __('modules.lead.clientEmail') . ': ' . $this->leadEmail;
        }

        // Inbox preview only — keep short and complementary to the Plunk subject
        // ("Lead assigned to you: {name}"), not a rehash of that sentence / body.
        $preheader = $this->inboxPreheader();

        $build
            ->subject('Lead owner assigned - ' . config('app.name'))
            ->view('mail.lead-assigned', [
                'url' => $url,
                'content' => implode('<br>', $contentParts),
                'preheader' => $preheader,
                'intro' => $preheader,
                'themeColor' => $this->company?->header_color,
                'actionText' => 'View Lead',
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachPlunkTemplate($build, 'cde4d601-d358-45e5-9782-1e79d5c4f9f7', [
            'preheader'         => $preheader,
            'leadName'          => $this->leadName,
            'leadEmail'         => $this->leadEmail,
            'previousOwnerName' => $this->previousOwnerName,
            'assignedAt'        => $this->assignedAt,
            'leadUrl'           => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    public function toArray($notifiable)
    {
        return [
            'id' => $this->leadId,
            'name' => $this->leadName,
            'previous_owner_id' => $this->previousOwnerId,
            'new_owner_id' => $notifiable->id,
            'added_by' => $this->addedBy,
            'title' => __('email.leadAgentAssigned.subject'),
            'text' => $this->safeMailText($this->assignmentText(), 240),
        ];
    }

    /**
     * Title + the notification's compact subject line already say "assigned as
     * lead agent" + the lead's name, so once an AI summary exists, this detail
     * text is the summary alone — repeating the base sentence there too would
     * just be the same redundant boilerplate again.
     */
    private function assignmentText(): string
    {
        $base = $this->leadName !== ''
            ? __('email.leadAgentAssigned.text', ['leadName' => $this->leadName])
            : __('email.leadAgentAssigned.subject').'.';

        $companyId = $this->companyId ?? $this->company?->id;
        $snippet = $companyId
            ? $this->aiSummarySnippetFor((int) $companyId, EntityAiSummary::TYPE_LEAD, $this->leadId)
            : null;

        return $snippet ?: $base;
    }

    /**
     * Short inbox snippet that complements the subject (no emails, no assignment
     * boilerplate). Used as both the hidden preheader and the first visible line.
     */
    private function inboxPreheader(): string
    {
        $companyId = $this->companyId ?? $this->company?->id;
        if ($companyId) {
            $snippet = $this->aiSummarySnippetFor(
                (int) $companyId,
                EntityAiSummary::TYPE_LEAD,
                $this->leadId,
                70
            );
            if ($snippet !== null && $snippet !== '') {
                return $this->safePreheader($snippet, 70);
            }
        }

        if ($this->previousOwnerName !== '' && strcasecmp($this->previousOwnerName, 'Unassigned') !== 0) {
            return $this->safePreheader('Previously '.$this->previousOwnerName, 70);
        }

        return $this->safePreheader('Open the lead to get started.', 70);
    }

    private function resolveCompany(): ?Company
    {
        if (! $this->companyId) {
            return null;
        }

        return Company::query()
            ->select([
                'id',
                'company_name',
                'company_email',
                'header_color',
                'date_format',
                'locale',
                'logo',
                'light_logo',
                'favicon',
            ])
            ->find($this->companyId);
    }
}
