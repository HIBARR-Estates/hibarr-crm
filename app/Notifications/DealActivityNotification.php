<?php

namespace App\Notifications;

use App\Enums\DealActivityType;
use App\Models\Deal;
use App\Models\EmailNotificationSetting;
use App\Models\User;
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
            ->where('slug', 'deal-activity-notification')
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
        $content = $this->getEmailContent($notifiable);
        $actionText = $this->getActionText();

        $introText = $this->getNotificationText($notifiable);

        $build
            ->subject($subject.' - '.config('app.name'))
            ->view('mail.deal.activity', [
                'url' => $url,
                'content' => $content,
                'subject' => $subject,
                'actionText' => $actionText,
                'introText' => $introText,
                'notifiableName' => $notifiable->name,
            ]);

        $this->attachPlunkTemplate($build, '0b42fd37-19ec-465d-b244-0dec0bbab80f', [
            'mailSubject' => $subject,
            'appName' => config('app.name'),
            'preheader' => $introText,
            'badgeLabel' => 'Deal Activity',
            'notifiableName' => $notifiable->name,
            'introText' => $introText,
            'contentHtml' => $content,
            'actionDescription' => __('Click the button below to view the deal details.'),
            'actionText' => $actionText,
            'dealUrl' => $url,
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
        $meetingDate = $this->formatMeetingDateFor($notifiable);

        return match ($this->activityType) {
            DealActivityType::NOTE_ADDED => "{$triggeredBy} added a note: ".($this->data['note_title'] ?? 'Untitled'),
            DealActivityType::NOTE_UPDATED => "{$triggeredBy} updated the note: ".($this->data['note_title'] ?? 'Untitled'),
            DealActivityType::STAGE_CHANGED => "{$triggeredBy} changed the stage from ".($this->data['from_stage'] ?? 'Unknown').' to '.($this->data['to_stage'] ?? 'Unknown'),
            DealActivityType::PIPELINE_CHANGED => "{$triggeredBy} changed the pipeline from ".($this->data['from_pipeline'] ?? 'Unknown').' to '.($this->data['to_pipeline'] ?? 'Unknown'),
            DealActivityType::DEAL_WON => "{$triggeredBy} marked this deal as won",
            DealActivityType::DEAL_LOST => "{$triggeredBy} marked this deal as lost",
            DealActivityType::TASK_ADDED => "{$triggeredBy} added a task: ".($this->data['task_heading'] ?? 'Untitled'),
            DealActivityType::TASK_UPDATED => "{$triggeredBy} updated the task: ".($this->data['task_heading'] ?? 'Untitled'),
            DealActivityType::TASK_COMPLETED => "{$triggeredBy} completed the task: ".($this->data['task_heading'] ?? 'Untitled'),
            DealActivityType::TASK_DELETED => "{$triggeredBy} deleted a task: ".($this->data['task_heading'] ?? 'Untitled'),
            DealActivityType::MEETING_SCHEDULED => "{$triggeredBy} scheduled a meeting".($meetingDate ? ' for '.$meetingDate : ''),
            DealActivityType::MEETING_UPDATED => "{$triggeredBy} updated a meeting".($meetingDate ? ' scheduled for '.$meetingDate : ''),
            DealActivityType::MEETING_CANCELLED => "{$triggeredBy} cancelled a meeting",
            DealActivityType::FILE_UPLOADED => "{$triggeredBy} uploaded a file: ".($this->data['file_name'] ?? 'Unknown'),
            DealActivityType::FILE_DELETED => "{$triggeredBy} deleted a file: ".($this->data['file_name'] ?? 'Unknown'),
            DealActivityType::PROPERTY_LINKED => "{$triggeredBy} linked a property: ".($this->data['property_title'] ?? 'Unknown'),
            DealActivityType::PROPERTY_UNLINKED => "{$triggeredBy} unlinked a property: ".($this->data['property_title'] ?? 'Unknown'),
            DealActivityType::PACKAGE_ASSIGNED => "{$triggeredBy} assigned ".($this->data['package_count'] ?? 1).' package(s)',
            DealActivityType::PACKAGE_REMOVED => "{$triggeredBy} removed ".($this->data['package_count'] ?? 1).' package(s)',
            DealActivityType::AGENT_ASSIGNED => "{$triggeredBy} assigned an agent to this deal",
            DealActivityType::AGENT_CHANGED => "{$triggeredBy} changed the deal agent from ".($this->data['from_agent_name'] ?? 'Unassigned').' to '.($this->data['to_agent_name'] ?? 'Unknown'),
            DealActivityType::WATCHER_ADDED => "{$triggeredBy} added you as a watcher",
            DealActivityType::WATCHER_REMOVED => "{$triggeredBy} removed you as a watcher",
        };
    }

    /**
     * Get the email subject line.
     */
    protected function getEmailSubject(): string
    {
        $dealName = $this->deal->name;
        $contactName = $this->deal->contact?->client_name ?? '';

        $prefix = $contactName ? "[{$contactName}] " : '';

        return match ($this->activityType) {
            DealActivityType::NOTE_ADDED => "{$prefix}New Note on Deal: {$dealName}",
            DealActivityType::NOTE_UPDATED => "{$prefix}Note Updated on Deal: {$dealName}",
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
     * Get the email content.
     *
     * @param  mixed  $notifiable
     */
    protected function getEmailContent($notifiable = null): string
    {
        $lines = [];
        $triggeredBy = $this->data['triggered_by_name'] ?? 'Someone';
        $dealName = $this->deal->name;
        $contactName = $this->deal->contact?->client_name ?? 'N/A';

        // Common deal info
        $lines[] = '<strong>'.__('modules.lead.clientName').":</strong> {$contactName}";
        $lines[] = '<strong>'.__('modules.deal.dealName').":</strong> {$dealName}";
        $lines[] = '<strong>'.__('app.changedBy').":</strong> {$triggeredBy}";
        $lines[] = '<br>';

        // Activity-specific content
        switch ($this->activityType) {
            case DealActivityType::NOTE_ADDED:
            case DealActivityType::NOTE_UPDATED:
                $lines[] = '<strong>Note Title:</strong> '.($this->data['note_title'] ?? 'Untitled');
                break;

            case DealActivityType::STAGE_CHANGED:
                $lines[] = '<strong>Previous Stage:</strong> '.($this->data['from_stage'] ?? 'Unknown');
                $lines[] = '<strong>New Stage:</strong> '.($this->data['to_stage'] ?? 'Unknown');
                break;

            case DealActivityType::PIPELINE_CHANGED:
                $lines[] = '<strong>Previous Pipeline:</strong> '.($this->data['from_pipeline'] ?? 'Unknown');
                $lines[] = '<strong>New Pipeline:</strong> '.($this->data['to_pipeline'] ?? 'Unknown');
                break;

            case DealActivityType::DEAL_WON:
            case DealActivityType::DEAL_LOST:
                $lines[] = '<strong>Outcome:</strong> '.ucfirst($this->data['outcome'] ?? $this->activityType->value);
                break;

            case DealActivityType::TASK_ADDED:
            case DealActivityType::TASK_UPDATED:
            case DealActivityType::TASK_COMPLETED:
            case DealActivityType::TASK_DELETED:
                $lines[] = '<strong>Task:</strong> '.($this->data['task_heading'] ?? 'Untitled');
                break;

            case DealActivityType::MEETING_SCHEDULED:
            case DealActivityType::MEETING_UPDATED:
            case DealActivityType::MEETING_CANCELLED:
                $lines[] = '<strong>Meeting:</strong> '.($this->data['meeting_remark'] ?? 'N/A');
                $meetingDate = $this->formatMeetingDateFor($notifiable);
                if ($meetingDate) {
                    $lines[] = '<strong>Date:</strong> '.$meetingDate;
                }
                break;

            case DealActivityType::FILE_UPLOADED:
            case DealActivityType::FILE_DELETED:
                $lines[] = '<strong>File:</strong> '.($this->data['file_name'] ?? 'Unknown');
                break;

            case DealActivityType::PROPERTY_LINKED:
            case DealActivityType::PROPERTY_UNLINKED:
                $lines[] = '<strong>Property:</strong> '.($this->data['property_title'] ?? 'Unknown');
                break;

            case DealActivityType::PACKAGE_ASSIGNED:
            case DealActivityType::PACKAGE_REMOVED:
                $packageNames = $this->data['package_names'] ?? [];
                if (! empty($packageNames)) {
                    $lines[] = '<strong>Packages:</strong> '.implode(', ', $packageNames);
                }
                break;

            case DealActivityType::AGENT_CHANGED:
                $lines[] = '<strong>Previous Agent:</strong> '.($this->data['from_agent_name'] ?? 'Unassigned');
                $lines[] = '<strong>New Agent:</strong> '.($this->data['to_agent_name'] ?? 'Unknown');
                break;
        }

        return implode('<br>', $lines);
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
            DealActivityType::NOTE_ADDED, DealActivityType::NOTE_UPDATED => ['note_id', 'note_title'],
            DealActivityType::STAGE_CHANGED => ['from_stage', 'to_stage'],
            DealActivityType::PIPELINE_CHANGED => ['from_pipeline', 'to_pipeline'],
            DealActivityType::DEAL_WON, DealActivityType::DEAL_LOST => ['outcome'],
            DealActivityType::TASK_ADDED, DealActivityType::TASK_UPDATED,
            DealActivityType::TASK_COMPLETED, DealActivityType::TASK_DELETED => ['task_id', 'task_heading'],
            DealActivityType::MEETING_SCHEDULED, DealActivityType::MEETING_UPDATED,
            DealActivityType::MEETING_CANCELLED => ['follow_up_id', 'meeting_remark', 'meeting_date'],
            DealActivityType::FILE_UPLOADED, DealActivityType::FILE_DELETED => ['file_id', 'file_name'],
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
