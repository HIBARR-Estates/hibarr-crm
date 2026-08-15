<?php

namespace App\Notifications;

use App\Enums\DealActivityType;
use App\Models\Deal;
use App\Models\EmailNotificationSetting;
use App\Models\User;
use App\Support\EntityActivityMailBuilder;
use App\Support\UserTimezone;
use Carbon\Carbon;

/**
 * Unified notification for all deal-related activities.
 *
 * This notification handles:
 * - Notes (added/updated)
 * - Stage changes
 * - Tasks (added/updated/completed)
 * - Meetings (scheduled/updated/cancelled)
 * - Files (uploaded/deleted)
 * - Properties (linked/unlinked)
 * - Packages (assigned/removed)
 *
 * The notification content is dynamically generated based on the activity type.
 */
class DealActivityNotification extends BaseNotification
{
    private Deal $deal;

    private DealActivityType $activityType;

    private array $data;

    private $emailSetting;

    /**
     * Create a new notification instance.
     *
     * @param  Deal  $deal  The deal associated with this notification
     * @param  DealActivityType  $activityType  The type of activity that occurred
     * @param  array  $data  Additional data for the notification
     */
    public function __construct(Deal $deal, DealActivityType $activityType, array $data = [])
    {
        $this->deal = $deal;
        $this->activityType = $activityType;
        $this->data = $data;
        $this->company = $this->deal->company;

        // Load email notification settings
        $this->emailSetting = EmailNotificationSetting::where('company_id', $this->company->id)
            ->where('slug', $this->activityType->emailSettingSlug())
            ->first();

        $this->initUnsRouting();
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param  mixed  $notifiable
     */
    public function via($notifiable): array
    {
        // Never notify the person who triggered the activity (including admins).
        $triggeredById = $this->data['triggered_by_id'] ?? null;
        if ($triggeredById !== null && (int) $notifiable->id === (int) $triggeredById) {
            return [];
        }

        $via = ['database'];

        // During bulk updates, suppress individual transactional emails.
        if ($this->suppressBulkTransactionalEmails) {
            return $via;
        }

        // Check if email notifications are enabled
        if ($this->emailSetting
            && $this->emailSetting->send_email == 'yes'
            && $notifiable->email_notifications
            && ! empty($notifiable->email)
        ) {
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

        $url = route('deals.show', $this->deal->id);
        $url = getDomainSpecificUrl($url, $this->company);

        $subject = $this->getEmailSubject();
        $actionText = $this->getActionText();
        $introText = $this->safeMailText($this->getNotificationText($notifiable), 500);
        $detailHtml = $this->getEmailDetailHtml($notifiable);
        $content = $this->getEmailContent($notifiable);
        if ($content !== '') {
            $content = '<div class="callout">'.$content.'</div>';
        }

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.deal.activity', [
                'url' => $url,
                'content' => $content,
                'detailHtml' => $detailHtml,
                'preheader' => $this->safePreheader($introText),
                'subject' => $subject,
                'actionText' => $actionText,
                'introText' => $introText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachEntityActivityPlunk($build, [
            'mailSubject' => $subject,
            'preheader' => $this->safePreheader($introText),
            'badgeLabel' => 'Deal Activity',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'detailHtml' => $detailHtml,
            'contentHtml' => $content,
            'actionDescription' => __('Click the button below to view the deal details.'),
            'actionText' => $actionText,
            'entityUrl' => $url,
        ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * Get the array representation of the notification.
     *
     * @param  mixed  $notifiable
     */
    public function toArray($notifiable): array
    {
        return [
            'id' => $this->deal->id,
            'deal_id' => $this->deal->id,
            'deal_name' => $this->deal->name,
            'activity_type' => $this->activityType->value,
            'activity_label' => $this->activityType->label(),
            'activity_icon' => $this->activityType->icon(),
            'heading' => $this->getNotificationHeading(),
            'text' => $this->getNotificationText($notifiable),
            'triggered_by' => $this->data['triggered_by_name'] ?? 'System',
            'triggered_by_id' => $this->data['triggered_by_id'] ?? null,
            'additional_data' => $this->getAdditionalDataForStorage($notifiable),
        ];
    }

    /**
     * Format meeting_date for a recipient (ISO UTC → local wall clock).
     * Legacy non-ISO strings are returned unchanged.
     *
     * @param  mixed  $notifiable
     */
    protected function formatMeetingDateFor($notifiable): ?string
    {
        $raw = $this->data['meeting_date'] ?? null;

        if ($raw === null || $raw === '') {
            return null;
        }

        if (! is_string($raw)) {
            return null;
        }

        // Heuristic: legacy pre-formatted strings like "Jan 19, 2026 15:00" are not ISO.
        if (! $this->looksLikeIsoDateTime($raw)) {
            return $raw;
        }

        try {
            $date = Carbon::parse($raw);
        } catch (\Throwable $e) {
            return $raw;
        }

        $timezone = UserTimezone::resolve(
            $notifiable instanceof User ? $notifiable : null,
            $this->company
        );

        return $date->copy()->setTimezone($timezone)->format('M d, Y H:i');
    }

    protected function looksLikeIsoDateTime(string $value): bool
    {
        return (bool) preg_match(
            '/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/',
            $value
        );
    }

    /**
     * Get the notification heading based on activity type.
     */
    protected function getNotificationHeading(): string
    {
        $dealName = $this->deal->name;
        $triggeredBy = $this->data['triggered_by_name'] ?? 'Someone';

        return match ($this->activityType) {
            DealActivityType::NOTE_ADDED => "Note added to deal: {$dealName}",
            DealActivityType::NOTE_UPDATED => "Note updated on deal: {$dealName}",
            DealActivityType::NOTE_DELETED => "Note deleted from deal: {$dealName}",
            DealActivityType::STAGE_CHANGED => "Deal stage changed: {$dealName}",
            DealActivityType::PIPELINE_CHANGED => "Deal pipeline changed: {$dealName}",
            DealActivityType::DEAL_WON => "Deal won: {$dealName}",
            DealActivityType::DEAL_LOST => "Deal lost: {$dealName}",
            DealActivityType::TASK_ADDED => "Task added to deal: {$dealName}",
            DealActivityType::TASK_UPDATED => "Task updated on deal: {$dealName}",
            DealActivityType::TASK_COMPLETED => "Task completed on deal: {$dealName}",
            DealActivityType::TASK_DELETED => "Task deleted from deal: {$dealName}",
            DealActivityType::MEETING_SCHEDULED => "Meeting scheduled for deal: {$dealName}",
            DealActivityType::MEETING_UPDATED => "Meeting updated for deal: {$dealName}",
            DealActivityType::MEETING_CANCELLED => "Meeting cancelled for deal: {$dealName}",
            DealActivityType::FILE_UPLOADED => "File uploaded to deal: {$dealName}",
            DealActivityType::FILE_UPDATED => "File updated on deal: {$dealName}",
            DealActivityType::FILE_DELETED => "File deleted from deal: {$dealName}",
            DealActivityType::PROPERTY_LINKED => "Property linked to deal: {$dealName}",
            DealActivityType::PROPERTY_UNLINKED => "Property unlinked from deal: {$dealName}",
            DealActivityType::PACKAGE_ASSIGNED => "Package assigned to deal: {$dealName}",
            DealActivityType::PACKAGE_REMOVED => "Package removed from deal: {$dealName}",
            DealActivityType::AGENT_ASSIGNED => "Agent assigned to deal: {$dealName}",
            DealActivityType::AGENT_CHANGED => "Agent changed on deal: {$dealName}",
            DealActivityType::WATCHER_ADDED => "You were added as a watcher on deal: {$dealName}",
            DealActivityType::WATCHER_REMOVED => "You were removed as a watcher from deal: {$dealName}",
        };
    }

    /**
     * Get the notification text/description.
     *
     * @param  mixed  $notifiable
     */
    protected function getNotificationText($notifiable = null): string
    {
        $triggeredBy = $this->data['triggered_by_name'] ?? 'Someone';
        $dealName = $this->safeMailText($this->deal->name ?? '', 200);
        $fieldLabel = $this->fileFieldLabel();

        return match ($this->activityType) {
            DealActivityType::NOTE_ADDED => "{$triggeredBy} added a note on {$dealName}.",
            DealActivityType::NOTE_UPDATED => "{$triggeredBy} updated a note on {$dealName}.",
            DealActivityType::NOTE_DELETED => "{$triggeredBy} deleted a note on {$dealName}.",
            DealActivityType::STAGE_CHANGED => "{$triggeredBy} changed the stage on {$dealName}.",
            DealActivityType::PIPELINE_CHANGED => "{$triggeredBy} changed the pipeline on {$dealName}.",
            DealActivityType::DEAL_WON => "{$triggeredBy} marked {$dealName} as won.",
            DealActivityType::DEAL_LOST => "{$triggeredBy} marked {$dealName} as lost.",
            DealActivityType::TASK_ADDED => "{$triggeredBy} added a task on {$dealName}.",
            DealActivityType::TASK_UPDATED => "{$triggeredBy} updated a task on {$dealName}.",
            DealActivityType::TASK_COMPLETED => "{$triggeredBy} completed a task on {$dealName}.",
            DealActivityType::TASK_DELETED => "{$triggeredBy} deleted a task on {$dealName}. This action cannot be undone.",
            DealActivityType::MEETING_SCHEDULED => "{$triggeredBy} scheduled a meeting for {$dealName}.",
            DealActivityType::MEETING_UPDATED => "{$triggeredBy} updated a meeting for {$dealName}.",
            DealActivityType::MEETING_CANCELLED => "{$triggeredBy} cancelled a meeting for {$dealName}.",
            DealActivityType::FILE_UPLOADED => $fieldLabel
                ? "{$triggeredBy} uploaded a file to {$fieldLabel} on {$dealName}."
                : "{$triggeredBy} added a file to {$dealName}.",
            DealActivityType::FILE_UPDATED => $fieldLabel
                ? "{$triggeredBy} updated a file on {$fieldLabel} for {$dealName}."
                : "{$triggeredBy} updated a file on {$dealName}.",
            DealActivityType::FILE_DELETED => $fieldLabel
                ? "{$triggeredBy} removed a file from {$fieldLabel} on {$dealName}. This action cannot be undone."
                : "{$triggeredBy} removed a file from {$dealName}. This action cannot be undone.",
            DealActivityType::PROPERTY_LINKED => "{$triggeredBy} linked a property to {$dealName}.",
            DealActivityType::PROPERTY_UNLINKED => "{$triggeredBy} unlinked a property from {$dealName}.",
            DealActivityType::PACKAGE_ASSIGNED => "{$triggeredBy} assigned packages to {$dealName}.",
            DealActivityType::PACKAGE_REMOVED => "{$triggeredBy} removed packages from {$dealName}.",
            DealActivityType::AGENT_ASSIGNED => "{$triggeredBy} assigned an agent to {$dealName}.",
            DealActivityType::AGENT_CHANGED => "{$triggeredBy} changed the agent on {$dealName}.",
            DealActivityType::WATCHER_ADDED => "{$triggeredBy} added you as a watcher on {$dealName}.",
            DealActivityType::WATCHER_REMOVED => "{$triggeredBy} removed you as a watcher from {$dealName}.",
        };
    }

    /**
     * Get the email subject line.
     */
    protected function getEmailSubject(): string
    {
        $dealName = $this->safeMailText($this->deal->name ?? '', 200);
        $contactName = $this->safeMailText($this->deal->contact?->client_name ?? '', 200);

        $prefix = $contactName ? "[{$contactName}] " : '';

        return match ($this->activityType) {
            DealActivityType::NOTE_ADDED => "{$prefix}New Note on Deal: {$dealName}",
            DealActivityType::NOTE_UPDATED => "{$prefix}Note Updated on Deal: {$dealName}",
            DealActivityType::NOTE_DELETED => "{$prefix}Note Deleted from Deal: {$dealName}",
            DealActivityType::STAGE_CHANGED => "{$prefix}Deal Stage Changed: {$dealName}",
            DealActivityType::PIPELINE_CHANGED => "{$prefix}Deal Pipeline Changed: {$dealName}",
            DealActivityType::DEAL_WON => "{$prefix}Deal Won: {$dealName}",
            DealActivityType::DEAL_LOST => "{$prefix}Deal Lost: {$dealName}",
            DealActivityType::TASK_ADDED => "{$prefix}New Task on Deal: {$dealName}",
            DealActivityType::TASK_UPDATED => "{$prefix}Task Updated on Deal: {$dealName}",
            DealActivityType::TASK_COMPLETED => "{$prefix}Task Completed on Deal: {$dealName}",
            DealActivityType::TASK_DELETED => "{$prefix}Task Deleted from Deal: {$dealName}",
            DealActivityType::MEETING_SCHEDULED => "{$prefix}Meeting Scheduled for Deal: {$dealName}",
            DealActivityType::MEETING_UPDATED => "{$prefix}Meeting Updated for Deal: {$dealName}",
            DealActivityType::MEETING_CANCELLED => "{$prefix}Meeting Cancelled for Deal: {$dealName}",
            DealActivityType::FILE_UPLOADED => "{$prefix}New File on Deal: {$dealName}",
            DealActivityType::FILE_UPDATED => "{$prefix}File Updated on Deal: {$dealName}",
            DealActivityType::FILE_DELETED => "{$prefix}File Deleted from Deal: {$dealName}",
            DealActivityType::PROPERTY_LINKED => "{$prefix}Property Linked to Deal: {$dealName}",
            DealActivityType::PROPERTY_UNLINKED => "{$prefix}Property Unlinked from Deal: {$dealName}",
            DealActivityType::PACKAGE_ASSIGNED => "{$prefix}Package Assigned to Deal: {$dealName}",
            DealActivityType::PACKAGE_REMOVED => "{$prefix}Package Removed from Deal: {$dealName}",
            DealActivityType::AGENT_ASSIGNED => "{$prefix}Agent Assigned to Deal: {$dealName}",
            DealActivityType::AGENT_CHANGED => "{$prefix}Agent Changed on Deal: {$dealName}",
            DealActivityType::WATCHER_ADDED => "{$prefix}You're now watching Deal: {$dealName}",
            DealActivityType::WATCHER_REMOVED => "{$prefix}You're no longer watching Deal: {$dealName}",
        };
    }

    /**
     * Prominent detail block — deal name, meeting date, task title, etc.
     *
     * @param  mixed  $notifiable
     */
    protected function getEmailDetailHtml($notifiable = null): string
    {
        $dealName = $this->safeMailText($this->deal->name ?? '', 200);
        $contactName = $this->safeMailText($this->deal->contact?->client_name ?? '', 200);
        $meta = $contactName !== '' ? "{$dealName} · {$contactName}" : $dealName;

        return match ($this->activityType) {
            DealActivityType::NOTE_ADDED,
            DealActivityType::NOTE_UPDATED,
            DealActivityType::NOTE_DELETED => EntityActivityMailBuilder::renderDetailBlock(
                $this->safeMailText($this->data['note_title'] ?? 'Untitled', 200),
                $meta,
            ),
            DealActivityType::TASK_ADDED,
            DealActivityType::TASK_UPDATED => EntityActivityMailBuilder::renderDetailBlock(
                $this->safeMailText($this->data['task_heading'] ?? 'Untitled', 200),
                $meta,
            ),
            DealActivityType::TASK_COMPLETED => EntityActivityMailBuilder::renderDetailBlock(
                $this->safeMailText($this->data['task_heading'] ?? 'Untitled', 200),
                $meta,
                __('Task completed.'),
            ),
            DealActivityType::TASK_DELETED => EntityActivityMailBuilder::renderDetailBlock(
                $this->safeMailText($this->data['task_heading'] ?? 'Untitled', 200),
                $meta,
                __('This action cannot be undone.'),
                true,
            ),
            DealActivityType::MEETING_SCHEDULED,
            DealActivityType::MEETING_UPDATED,
            DealActivityType::MEETING_CANCELLED => $this->meetingDetailHtml($notifiable, $meta),
            DealActivityType::FILE_UPLOADED,
            DealActivityType::FILE_UPDATED,
            DealActivityType::FILE_DELETED => $this->fileDetailHtml($meta),
            DealActivityType::PROPERTY_LINKED,
            DealActivityType::PROPERTY_UNLINKED => EntityActivityMailBuilder::renderDetailBlock(
                $this->safeMailText($this->data['property_title'] ?? 'Unknown', 200),
                $meta,
            ),
            DealActivityType::DEAL_WON,
            DealActivityType::DEAL_LOST => EntityActivityMailBuilder::renderDetailBlock(
                ucfirst($this->safeMailText($this->data['outcome'] ?? $this->activityType->value, 200)),
                $meta,
            ),
            default => EntityActivityMailBuilder::renderDetailBlock(null, $meta),
        };
    }

    /**
     * Supplemental lines only — no repeated deal name or actor.
     *
     * @param  mixed  $notifiable
     */
    protected function getEmailContent($notifiable = null): string
    {
        $lines = match ($this->activityType) {
            DealActivityType::STAGE_CHANGED => [
                EntityActivityMailBuilder::supplementalLine(
                    __('Previous Stage'),
                    $this->safeMailText($this->data['from_stage'] ?? 'Unknown', 200),
                ),
                EntityActivityMailBuilder::supplementalLine(
                    __('New Stage'),
                    $this->safeMailText($this->data['to_stage'] ?? 'Unknown', 200),
                ),
            ],
            DealActivityType::PIPELINE_CHANGED => [
                EntityActivityMailBuilder::supplementalLine(
                    __('Previous Pipeline'),
                    $this->safeMailText($this->data['from_pipeline'] ?? 'Unknown', 200),
                ),
                EntityActivityMailBuilder::supplementalLine(
                    __('New Pipeline'),
                    $this->safeMailText($this->data['to_pipeline'] ?? 'Unknown', 200),
                ),
            ],
            DealActivityType::AGENT_CHANGED => [
                EntityActivityMailBuilder::supplementalLine(
                    __('Previous Agent'),
                    $this->safeMailText($this->data['from_agent_name'] ?? 'Unassigned', 100),
                ),
                EntityActivityMailBuilder::supplementalLine(
                    __('New Agent'),
                    $this->safeMailText($this->data['to_agent_name'] ?? 'Unknown', 100),
                ),
            ],
            DealActivityType::PACKAGE_ASSIGNED,
            DealActivityType::PACKAGE_REMOVED => $this->packageSupplementalLines(),
            default => [],
        };

        return EntityActivityMailBuilder::joinSupplemental($lines);
    }

    /**
     * @param  mixed  $notifiable
     */
    protected function meetingDetailHtml($notifiable, string $meta): string
    {
        $formatted = $this->formatMeetingDateFor($notifiable);
        $parts = $formatted ? EntityActivityMailBuilder::splitDateAndTime($formatted) : null;
        $title = $parts
            ? EntityActivityMailBuilder::formatDateTimeTitle($parts['date'], $parts['time'])
            : null;

        $remark = $this->safeMailText($this->data['meeting_remark'] ?? '', 500);
        $subtext = $this->activityType === DealActivityType::MEETING_CANCELLED
            ? __('Meeting cancelled')
            : ($remark !== '' ? $remark : null);

        return EntityActivityMailBuilder::renderDetailBlock($title, $meta, $subtext);
    }

    protected function fileDetailHtml(string $meta): string
    {
        $fieldLabel = $this->fileFieldLabel();
        $warning = in_array($this->activityType, [DealActivityType::FILE_DELETED], true);

        if ($fieldLabel !== null) {
            return EntityActivityMailBuilder::renderDetailBlock(
                $fieldLabel,
                $meta,
                $warning ? __('This action cannot be undone.') : null,
                $warning,
            );
        }

        return EntityActivityMailBuilder::renderDetailBlock(
            null,
            $meta,
            $warning ? __('This action cannot be undone.') : null,
            $warning,
        );
    }

    /**
     * @return array<int, string>
     */
    protected function packageSupplementalLines(): array
    {
        $packageNames = $this->data['package_names'] ?? [];
        if (empty($packageNames)) {
            return [];
        }

        $names = collect($packageNames)
            ->map(fn ($name) => $this->safeMailText((string) $name, 200))
            ->filter()
            ->implode(', ');

        return [EntityActivityMailBuilder::supplementalLine(__('Packages'), $names)];
    }

    protected function fileFieldLabel(): ?string
    {
        $label = trim((string) ($this->data['field_label'] ?? ''));

        return $label !== '' ? $this->safeMailText($label, 200) : null;
    }

    /**
     * Get the action button text.
     */
    protected function getActionText(): string
    {
        return __('email.dealStatus.action');
    }

    /**
     * Get additional data to store with the notification.
     *
     * @param  mixed  $notifiable
     */
    protected function getAdditionalDataForStorage($notifiable = null): array
    {
        // Return only relevant additional data based on activity type
        $relevant = [];

        $keys = match ($this->activityType) {
            DealActivityType::NOTE_ADDED, DealActivityType::NOTE_UPDATED, DealActivityType::NOTE_DELETED => ['note_id', 'note_title'],
            DealActivityType::STAGE_CHANGED => ['from_stage', 'to_stage'],
            DealActivityType::PIPELINE_CHANGED => ['from_pipeline', 'to_pipeline'],
            DealActivityType::DEAL_WON, DealActivityType::DEAL_LOST => ['outcome'],
            DealActivityType::TASK_ADDED, DealActivityType::TASK_UPDATED,
            DealActivityType::TASK_COMPLETED, DealActivityType::TASK_DELETED => ['task_id', 'task_heading'],
            DealActivityType::MEETING_SCHEDULED, DealActivityType::MEETING_UPDATED,
            DealActivityType::MEETING_CANCELLED => ['follow_up_id', 'meeting_remark', 'meeting_date'],
            DealActivityType::FILE_UPLOADED, DealActivityType::FILE_UPDATED, DealActivityType::FILE_DELETED => ['file_id', 'field_label'],
            DealActivityType::PROPERTY_LINKED, DealActivityType::PROPERTY_UNLINKED => ['property_id', 'property_title'],
            DealActivityType::PACKAGE_ASSIGNED, DealActivityType::PACKAGE_REMOVED => ['package_names', 'package_count'],
            DealActivityType::AGENT_CHANGED => ['from_agent_name', 'to_agent_name'],
            default => [],
        };

        foreach ($keys as $key) {
            if (isset($this->data[$key])) {
                if ($key === 'meeting_date') {
                    // Store localized display string for this recipient's in-app UI.
                    $formatted = $this->formatMeetingDateFor($notifiable);
                    if ($formatted !== null) {
                        $relevant[$key] = $formatted;
                    }

                    continue;
                }
                $relevant[$key] = $this->data[$key];
            }
        }

        return $relevant;
    }
}
