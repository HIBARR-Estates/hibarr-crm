<?php

namespace App\Notifications;

use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\EmailNotificationSetting;
use App\Models\LeadNote;
use App\Models\Reminder;
use App\Models\ReminderEmailTemplate;
use App\Models\Task;
use App\Models\Lead;
use App\Support\LeadLocaleResolver;
use App\Support\MeetingEmailPresenter;
use App\Support\SafeHttpUrl;
use Carbon\CarbonInterface;
use Carbon\CarbonInterval;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Str;

class ReminderNotification extends BaseNotification
{
    private Reminder $reminder;

    private ?EmailNotificationSetting $emailSetting;

    private string $anonymousName = 'there';

    private bool $mailOnly = false;

    private ?DealFollowUp $followUp = null;

    private bool $followUpLoaded = false;

    private ?Task $task = null;

    private bool $taskLoaded = false;

    private DealNote|LeadNote|null $note = null;

    private bool $noteLoaded = false;

    public function __construct(Reminder $reminder)
    {
        $this->reminder = $reminder;
        $this->company = $reminder->company()->first();
        $this->emailSetting = $this->resolveEmailSetting();
        $this->initUnsRouting();
        // Always route entity reminder mail through UNS/Plunk — do not fall back to SMTP
        // when crm.notification-service-routing is off.
        $this->forceUnsRouting();
        // Prefer inline delivery when queued; ReminderSender uses sendNow/notifyNow.
        $this->onConnection('sync');
    }

    protected function unsIdempotencyPrefix(): ?string
    {
        return 'crm-reminder-'.$this->reminder->id;
    }

    public function forAnonymousMail(string $name): self
    {
        $this->anonymousName = $name;
        $this->mailOnly = true;

        return $this;
    }

    public function via($notifiable): array
    {
        if ($this->mailOnly) {
            return $this->shouldSendMail($notifiable) ? ['mail'] : [];
        }

        $via = ['database'];

        if ($this->shouldSendMail($notifiable)) {
            $via[] = 'mail';
        }

        if (
            $this->emailSetting
            && $this->emailSetting->send_push === 'yes'
            && push_setting()->beams_push_status === 'active'
            && isset($notifiable->id)
        ) {
            [$pushTitle, $pushBody] = $this->resolvePushContent();
            $pushNotification = new \App\Http\Controllers\DashboardController;
            $pushNotification->sendPushNotifications(
                [[$notifiable->id]],
                $pushTitle,
                $pushBody
            );
        }

        return $via;
    }

    /**
     * Push title/body. Meeting pushes get the same countdown-aware wording as the
     * participant email instead of the generic subject + raw remark.
     *
     * @return array{0: string, 1: string}
     */
    private function resolvePushContent(): array
    {
        if ($this->reminder->entity_type !== Reminder::ENTITY_MEETING) {
            return [$this->resolveSubjectHeading(), $this->reminder->message ?? ''];
        }

        $followUp = $this->resolveFollowUp();
        if ($followUp === null) {
            return [$this->resolveSubjectHeading(), $this->reminder->message ?? ''];
        }

        $isLeadRecipient = $this->reminder->recipient_type === Reminder::RECIPIENT_LEAD;
        $presenter = new MeetingEmailPresenter(
            $followUp,
            $this->company,
            $this->reminder->message
        );

        $title = $presenter->subject($isLeadRecipient, false);
        $body = $presenter->message($isLeadRecipient, false);
        $meetingRemark = $presenter->meetingRemark();
        if (!$isLeadRecipient && $presenter->meetingAt() !== null && $meetingRemark !== '') {
            $body .= ' '.Str::limit($meetingRemark, 80);
        }

        return [$title, $body];
    }

    public function toMail($notifiable): MailMessage
    {
        return match ($this->reminder->entity_type) {
            Reminder::ENTITY_TASK => $this->toTaskMail($notifiable),
            Reminder::ENTITY_DEAL_NOTE, Reminder::ENTITY_LEAD_NOTE => $this->toNoteMail($notifiable),
            Reminder::ENTITY_MEETING => $this->toMeetingMail($notifiable),
            Reminder::ENTITY_DEAL => $this->toTypedEntityMail($notifiable, 'deal'),
            Reminder::ENTITY_LEAD => $this->toTypedEntityMail($notifiable, 'lead'),
            Reminder::ENTITY_PROPERTY => $this->toTypedEntityMail($notifiable, 'property'),
            Reminder::ENTITY_DEVELOPER_PROJECT => $this->toTypedEntityMail($notifiable, 'project'),
            Reminder::ENTITY_UNIT => $this->toTypedEntityMail($notifiable, 'unit'),
            Reminder::ENTITY_FLIGHT_ITINERARY => $this->toTypedEntityMail($notifiable, 'flight'),
            default => $this->toMeetingMail($notifiable),
        };
    }

    public function toArray($notifiable): array
    {
        $payload = [
            'reminder_id' => $this->reminder->id,
            'entity_type' => $this->reminder->entity_type,
            'entity_id' => $this->reminder->entity_id,
            'remind_at' => optional($this->reminder->remind_at)->toIso8601String(),
            'heading' => $this->resolveSubjectHeading(),
            'title' => $this->resolveSubjectHeading(),
            'text' => $this->resolveInAppMessage(),
            'action_url' => $this->resolveActionUrl(),
        ];

        if ($this->reminder->entity_type === Reminder::ENTITY_MEETING) {
            $payload = array_merge($payload, $this->meetingContextPayload());
        }

        if ($this->reminder->entity_type === Reminder::ENTITY_TASK) {
            $payload = array_merge($payload, $this->taskContextPayload());
        }

        return $payload;
    }

    /**
     * Task + linked deal/lead for in-app task reminder actions.
     *
     * @return array<string, mixed>
     */
    private function taskContextPayload(): array
    {
        $task = $this->resolveTask();
        if ($task === null) {
            return [];
        }

        return [
            'task_id' => $task->id,
        ];
    }

    /**
     * Deal/lead + join link for in-app meeting reminder actions.
     *
     * @return array<string, mixed>
     */
    private function meetingContextPayload(): array
    {
        $followUp = $this->resolveFollowUp();
        if ($followUp === null) {
            return [];
        }

        $presenter = new MeetingEmailPresenter($followUp, $this->company, $this->reminder->message);
        $meetingAt = $presenter->meetingAt();
        $startsNow = $meetingAt !== null
            && $meetingAt->getTimestamp() - now()->getTimestamp() <= 0;

        $payload = [
            'follow_up_id' => $followUp->id,
            'deal_id' => $followUp->deal_id,
            'lead_id' => $followUp->lead_id,
            'starts_now' => $startsNow,
        ];

        if (\App\Support\MeetingLocation::supportsJoinLink($followUp->location ?? null)) {
            $meetingLink = SafeHttpUrl::validate($followUp->meeting_link);
            if ($meetingLink !== null) {
                $payload['meeting_link'] = $meetingLink;
            }
        }

        return array_filter(
            $payload,
            static fn ($value) => $value !== null && $value !== '' && $value !== false,
        );
    }

    /**
     * Countdown-aware body text for the in-app notification — the same wording used
     * in the reminder email, so the bell dropdown isn't the only place lacking context.
     */
    private function resolveInAppMessage(): string
    {
        $timezone = $this->company->timezone ?? config('app.timezone');

        return match ($this->reminder->entity_type) {
            Reminder::ENTITY_TASK => (function () use ($timezone) {
                $task = $this->resolveTask();
                $heading = $task?->heading ?? ($this->reminder->message ?? 'Task');
                $dueAt = $task?->remind_at ? $task->remind_at->copy()->timezone($timezone) : null;
                $countdown = $dueAt ? $this->countdownUntil($dueAt) : '';

                return $this->resolveTaskMessage($heading, $dueAt, $countdown);
            })(),
            Reminder::ENTITY_DEAL_NOTE, Reminder::ENTITY_LEAD_NOTE => (function () use ($timezone) {
                $note = $this->resolveNote();
                $title = $note?->title ?? ($this->reminder->message ?? 'Note');
                $remindAt = $note?->remind_at
                    ? $note->remind_at->copy()->timezone($timezone)
                    : ($this->reminder->remind_at?->copy()->timezone($timezone));
                $countdown = $remindAt ? $this->countdownUntil($remindAt) : '';

                return $this->resolveNoteMessage($title, $remindAt, $countdown);
            })(),
            Reminder::ENTITY_MEETING => (function () {
                $followUp = $this->resolveFollowUp();
                if ($followUp === null) {
                    return $this->reminder->message ?? $this->resolveSubjectHeading();
                }

                $isLeadRecipient = $this->reminder->recipient_type === Reminder::RECIPIENT_LEAD;
                $presenter = new MeetingEmailPresenter($followUp, $this->company, $this->reminder->message);

                return $presenter->message($isLeadRecipient, false);
            })(),
            default => (function () use ($timezone) {
                $eventAt = $this->reminder->remind_at?->copy()->timezone($timezone);
                $title = $this->reminder->message ?: $this->resolveSubjectHeading();
                $countdown = $eventAt ? $this->countdownUntil($eventAt) : '';

                return $this->resolveGenericEntityMessage($title, $eventAt, $countdown);
            })(),
        };
    }

    private function resolveActionUrl(): string
    {
        return match ($this->reminder->entity_type) {
            Reminder::ENTITY_TASK => $this->resolveTaskUrl($this->resolveTask()),
            Reminder::ENTITY_DEAL_NOTE, Reminder::ENTITY_LEAD_NOTE => $this->resolveNoteUrl($this->resolveNote()),
            Reminder::ENTITY_MEETING => $this->resolveMeetingUrl(),
            Reminder::ENTITY_DEAL,
            Reminder::ENTITY_LEAD,
            Reminder::ENTITY_PROPERTY,
            Reminder::ENTITY_DEVELOPER_PROJECT,
            Reminder::ENTITY_UNIT,
            Reminder::ENTITY_FLIGHT_ITINERARY => $this->resolveGenericEntityUrl(),
            default => url('/'),
        };
    }

    private function resolveMeetingUrl(): string
    {
        $followUp = $this->resolveFollowUp();
        if ($followUp === null) {
            return url('/');
        }

        if ($followUp->deal_id) {
            $url = route('deals.show', $followUp->deal_id).'?tab=meetings';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        if ($followUp->lead_id) {
            $url = route('lead-contact.show', $followUp->lead_id).'?tab=meetings';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        return url('/');
    }

    private function toMeetingMail($notifiable): MailMessage
    {
        $followUp = $this->resolveFollowUp();

        if ($followUp === null) {
            $build = parent::build($notifiable);
            $build
                ->subject($this->resolveSubjectHeading().' - '.config('app.name'))
                ->markdown('mail.email', [
                    'url' => '#',
                    'content' => $this->reminder->message ?? '',
                    'themeColor' => $this->company->header_color,
                    'actionText' => __('email.meetingReminder.action'),
                    'notifiableName' => $notifiable->name ?? $this->anonymousName,
                ]);
            parent::resetLocale();

            return $build;
        }

        $isLeadRecipient = $this->reminder->recipient_type === Reminder::RECIPIENT_LEAD;
        if ($isLeadRecipient) {
            $lead = $this->resolveLeadForMeetingMail($followUp);
            if ($lead !== null) {
                LeadLocaleResolver::apply($lead, $this->company);
            }
        }

        $build = parent::build($notifiable);
        $presenter = new MeetingEmailPresenter(
            $followUp,
            $this->company,
            $this->reminder->message
        );
        $variables = $presenter->templateVariables($notifiable, $isLeadRecipient, false);

        $build
            ->subject($variables['mailSubject'].' - '.$variables['appName'])
            ->view('mail.deal-follow-up.deal-follow-up-reminder', $variables);

        $this->attachPlunkTemplateIfConfigured($build, 'meeting', MeetingEmailPresenter::plunkVariables($variables));

        // No .ics attachment here: by the time a countdown reminder fires, the
        // recipient already has the invite from the "meeting created" notice —
        // resending it would just prompt them to needlessly re-accept it.
        parent::resetLocale();

        return $build;
    }

    private function toTaskMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $task = $this->resolveTask();
        $url = $this->resolveTaskUrl($task);
        $name = $notifiable->name ?? $this->anonymousName;
        $timezone = $this->company->timezone ?? config('app.timezone');
        $dateFormat = $this->company->date_format ?? config('app.date_format', 'Y-m-d');
        $timeFormat = $this->company->time_format ?? config('app.time_format', 'H:i');

        $dueAt = $task?->remind_at
            ? $task->remind_at->copy()->timezone($timezone)
            : null;
        $heading = $this->safeMailText($task?->heading ?? ($this->reminder->message ?? 'Task'), 200);
        $shortCode = $this->safeMailText((string) ($task?->task_short_code ?? ''), 64);
        $dueDate = $dueAt?->format($dateFormat) ?? '';
        $dueTime = $dueAt?->format($timeFormat) ?? '';
        $countdown = $dueAt ? $this->countdownUntil($dueAt) : '';
        $taskMessage = $this->safeMailText($this->resolveTaskMessage($heading, $dueAt, $countdown), 500);
        $actionText = __('app.viewTask');
        $footerNote = __('email.taskReminder.footerNote');
        $preheader = $this->safePreheader($taskMessage !== '' ? $taskMessage : $footerNote);

        $build
            ->subject($this->titledSubject('email.taskReminder.subject', 'Task Reminder', $heading).' - '.config('app.name'))
            ->view('mail.task.task-reminder', [
                'url' => $url,
                'preheader' => $preheader,
                'taskMessage' => $taskMessage,
                'taskHeading' => $heading,
                'taskShortCode' => $shortCode,
                'dueDate' => $dueDate,
                'dueTime' => $dueTime,
                'actionText' => $actionText,
                'footerNote' => $footerNote,
                'notifiableName' => $name,
            ]);

        $this->attachPlunkTemplateIfConfigured($build, 'task', [
                'preheader' => $preheader,
                'taskMessage' => $taskMessage,
                'taskHeading' => $heading,
                'taskShortCode' => $shortCode,
                'dueDate' => $dueDate,
                'dueTime' => $dueTime,
                'taskUrl' => $url,
                'footerNote' => $footerNote,
            ]);

        parent::resetLocale();

        return $build;
    }

    private function toNoteMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $note = $this->resolveNote();
        $url = $this->resolveNoteUrl($note);
        $name = $notifiable->name ?? $this->anonymousName;
        $timezone = $this->company->timezone ?? config('app.timezone');
        $dateFormat = $this->company->date_format ?? config('app.date_format', 'Y-m-d');
        $timeFormat = $this->company->time_format ?? config('app.time_format', 'H:i');

        $remindAt = $note?->remind_at
            ? $note->remind_at->copy()->timezone($timezone)
            : ($this->reminder->remind_at?->copy()->timezone($timezone));
        $title = $this->safeMailText($note?->title ?? ($this->reminder->message ?? 'Note'), 200);
        $excerpt = $this->safeMailText($this->noteExcerpt($note?->details ?? ''), 500);
        $remindDate = $remindAt?->format($dateFormat) ?? '';
        $remindTime = $remindAt?->format($timeFormat) ?? '';
        $countdown = $remindAt ? $this->countdownUntil($remindAt) : '';
        $noteMessage = $this->safeMailText($this->resolveNoteMessage($title, $remindAt, $countdown), 500);
        $actionText = 'View Note';
        $footerNote = __('email.noteReminder.footerNote');
        $preheader = $this->safePreheader($noteMessage !== '' ? $noteMessage : $footerNote);

        $build
            ->subject($this->titledSubject('email.noteReminder.subject', 'Note Reminder', $title).' - '.config('app.name'))
            ->view('mail.note.note-reminder', [
                'url' => $url,
                'preheader' => $preheader,
                'noteMessage' => $noteMessage,
                'noteTitle' => $title,
                'noteExcerpt' => $excerpt,
                'remindDate' => $remindDate,
                'remindTime' => $remindTime,
                'actionText' => $actionText,
                'footerNote' => $footerNote,
                'notifiableName' => $name,
            ]);

        $this->attachPlunkTemplateIfConfigured($build, 'note', [
                'preheader' => $preheader,
                'noteMessage' => $noteMessage,
                'noteTitle' => $title,
                'noteExcerpt' => $excerpt,
                'remindDate' => $remindDate,
                'remindTime' => $remindTime,
                'noteUrl' => $url,
                'footerNote' => $footerNote,
            ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * Per-entity branded reminder mail (deal/lead/property/project/unit/flight).
     *
     * @param  'deal'|'lead'|'property'|'project'|'unit'|'flight'  $kind
     */
    private function toTypedEntityMail($notifiable, string $kind): MailMessage
    {
        $build = parent::build($notifiable);
        $url = $this->resolveGenericEntityUrl();
        $name = $notifiable->name ?? $this->anonymousName;
        $timezone = $this->company->timezone ?? config('app.timezone');
        $dateFormat = $this->company->date_format ?? config('app.date_format', 'Y-m-d');
        $timeFormat = $this->company->time_format ?? config('app.time_format', 'H:i');

        $meta = $this->typedEntityMailMeta($kind);
        $eventAt = $this->reminder->remind_at?->copy()->timezone($timezone);
        $title = $this->safeMailText($this->reminder->message ?: $meta['label'], 200);
        $eventDate = $eventAt?->format($dateFormat) ?? '';
        $eventTime = $eventAt?->format($timeFormat) ?? '';
        $countdown = $eventAt ? $this->countdownUntil($eventAt) : '';
        $message = $this->safeMailText($this->resolveGenericEntityMessage($title, $eventAt, $countdown), 500);
        $actionText = 'View '.$meta['label'];
        $footerNote = __($meta['footerNoteKey']);
        $preheader = $this->safePreheader($message !== '' ? $message : $footerNote);

        $messageKey = $meta['prefix'].'Message';
        $titleKey = $meta['prefix'].'Title';
        $urlKey = $meta['prefix'].'Url';

        $build
            ->subject($this->titledSubject($meta['subjectKey'], $meta['label'].' Reminder', $title).' - '.config('app.name'))
            ->view($meta['view'], [
                'url' => $url,
                'preheader' => $preheader,
                $messageKey => $message,
                $titleKey => $title,
                'eventDate' => $eventDate,
                'eventTime' => $eventTime,
                'actionText' => $actionText,
                'footerNote' => $footerNote,
                'notifiableName' => $name,
            ]);

        $this->attachPlunkTemplateIfConfigured($build, $kind, [
                'preheader' => $preheader,
                $messageKey => $message,
                $titleKey => $title,
                'eventDate' => $eventDate,
                'eventTime' => $eventTime,
                $urlKey => $url,
                'footerNote' => $footerNote,
            ]);

        parent::resetLocale();

        return $build;
    }

    /**
     * @return array{label: string, prefix: string, view: string, subjectKey: string, footerNoteKey: string}
     */
    private function typedEntityMailMeta(string $kind): array
    {
        return match ($kind) {
            'deal' => [
                'label' => 'Deal',
                'prefix' => 'deal',
                'view' => 'mail.deal.deal-reminder',
                'subjectKey' => 'email.dealReminder.subject',
                'footerNoteKey' => 'email.dealReminder.footerNote',
            ],
            'lead' => [
                'label' => 'Lead',
                'prefix' => 'lead',
                'view' => 'mail.lead.lead-reminder',
                'subjectKey' => 'email.leadReminder.subject',
                'footerNoteKey' => 'email.leadReminder.footerNote',
            ],
            'property' => [
                'label' => 'Property',
                'prefix' => 'property',
                'view' => 'mail.property.property-reminder',
                'subjectKey' => 'email.propertyReminder.subject',
                'footerNoteKey' => 'email.propertyReminder.footerNote',
            ],
            'project' => [
                'label' => 'Project',
                'prefix' => 'project',
                'view' => 'mail.developer-project.developer-project-reminder',
                'subjectKey' => 'email.developerProjectReminder.subject',
                'footerNoteKey' => 'email.developerProjectReminder.footerNote',
            ],
            'unit' => [
                'label' => 'Unit',
                'prefix' => 'unit',
                'view' => 'mail.developer-project-unit-type.developer-project-unit-type-reminder',
                'subjectKey' => 'email.unitReminder.subject',
                'footerNoteKey' => 'email.unitReminder.footerNote',
            ],
            'flight' => [
                'label' => 'Flight',
                'prefix' => 'flight',
                'view' => 'mail.lead-flight-itinerary.lead-flight-itinerary-reminder',
                'subjectKey' => 'email.flightReminder.subject',
                'footerNoteKey' => 'email.flightReminder.footerNote',
            ],
            default => [
                'label' => 'Reminder',
                'prefix' => 'deal',
                'view' => 'mail.deal.deal-reminder',
                'subjectKey' => 'email.dealReminder.subject',
                'footerNoteKey' => 'email.dealReminder.footerNote',
            ],
        };
    }

    /**
     * @param  array<string, mixed>  $variables
     */
    private function attachPlunkTemplateIfConfigured(MailMessage $build, string $mailEntityType, array $variables): void
    {
        $companyId = $this->company?->id ? (int) $this->company->id : 0;
        $templateId = ReminderEmailTemplate::plunkTemplateId($companyId, $mailEntityType);
        if ($templateId === null) {
            return;
        }

        $this->attachPlunkTemplate($build, $templateId, $variables);
    }

    private function resolveEmailSetting(): ?EmailNotificationSetting
    {
        if (! $this->company) {
            return null;
        }

        $slug = match ($this->reminder->entity_type) {
            Reminder::ENTITY_TASK => 'user-assign-to-task',
            Reminder::ENTITY_DEAL_NOTE, Reminder::ENTITY_LEAD_NOTE => 'follow-up-reminder',
            Reminder::ENTITY_MEETING => 'follow-up-reminder',
            default => 'follow-up-reminder',
        };

        return EmailNotificationSetting::where('company_id', $this->company->id)
            ->where('slug', $slug)
            ->first();
    }

    /**
     * Subject/heading used for the database notification and (for non-meeting
     * entities) the push title. Always names the specific record — "Deal Reminder"
     * alone doesn't tell anyone which deal, so every branch interpolates a title.
     */
    private function resolveSubjectHeading(): string
    {
        $fallbackTitle = trim((string) ($this->reminder->message ?? ''));

        return match ($this->reminder->entity_type) {
            Reminder::ENTITY_TASK => $this->titledSubject(
                'email.taskReminder.subject',
                'Task Reminder',
                $this->resolveTask()?->heading ?? $fallbackTitle
            ),
            Reminder::ENTITY_DEAL_NOTE, Reminder::ENTITY_LEAD_NOTE => $this->titledSubject(
                'email.noteReminder.subject',
                'Note Reminder',
                $this->resolveNote()?->title ?? $fallbackTitle
            ),
            Reminder::ENTITY_MEETING => (function () {
                $followUp = $this->resolveFollowUp();
                if ($followUp === null) {
                    return $this->titledSubject(
                        'email.followUpReminder.subject',
                        'Meeting Reminder',
                        $this->reminder->message ?? ''
                    );
                }

                $isLeadRecipient = $this->reminder->recipient_type === Reminder::RECIPIENT_LEAD;
                $presenter = new MeetingEmailPresenter($followUp, $this->company, $this->reminder->message);

                return $presenter->subject($isLeadRecipient, false);
            })(),
            Reminder::ENTITY_DEAL => $this->titledSubject('email.dealReminder.subject', 'Deal Reminder', $fallbackTitle),
            Reminder::ENTITY_LEAD => $this->titledSubject('email.leadReminder.subject', 'Lead Reminder', $fallbackTitle),
            Reminder::ENTITY_PROPERTY => $this->titledSubject('email.propertyReminder.subject', 'Property Reminder', $fallbackTitle),
            Reminder::ENTITY_DEVELOPER_PROJECT => $this->titledSubject('email.developerProjectReminder.subject', 'Project Reminder', $fallbackTitle),
            Reminder::ENTITY_UNIT => $this->titledSubject('email.unitReminder.subject', 'Unit Reminder', $fallbackTitle),
            Reminder::ENTITY_FLIGHT_ITINERARY => $this->titledSubject('email.flightReminder.subject', 'Flight Reminder', $fallbackTitle),
            default => __('email.followUpReminder.subject'),
        };
    }

    /**
     * Interpolates :title into a lang string; falls back to "{label}: {title}" if the
     * lang key has no :title placeholder, or to the bare label if there's no title at all.
     */
    private function titledSubject(string $langKey, string $fallbackLabel, ?string $title): string
    {
        $template = __($langKey);
        $title = trim((string) $title);

        if ($title === '') {
            if ($template === $langKey) {
                return $fallbackLabel;
            }

            return trim((string) preg_replace('/\s*:\s*:title|:title/', '', $template));
        }

        if (! str_contains($template, ':title')) {
            return $fallbackLabel.': '.$title;
        }

        return str_replace(':title', $title, $template);
    }

    private function shouldSendMail($notifiable): bool
    {
        if (! $this->emailSetting || $this->emailSetting->send_email !== 'yes') {
            return false;
        }

        if ($this->mailOnly) {
            return true;
        }

        return (bool) ($notifiable->email_notifications ?? true)
            && ! empty($notifiable->email);
    }

    private function resolveTaskUrl(?Task $task): string
    {
        if (! $task) {
            return url('/');
        }

        // Always the Inertia React task page — not front.task_detail (legacy Blade).
        $url = route('tasks.show', $task->id);

        return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
    }

    private function resolveNoteUrl(DealNote|LeadNote|null $note): string
    {
        if ($note instanceof DealNote && $note->deal_id) {
            $url = route('deals.show', $note->deal_id).'?tab=notes';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        if ($note instanceof LeadNote && $note->lead_id) {
            $url = route('lead-contact.show', $note->lead_id).'?drawer=notes';

            return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
        }

        return url('/');
    }

    private function resolveGenericEntityUrl(): string
    {
        $type = $this->reminder->entity_type;
        $id = (int) $this->reminder->entity_id;

        $url = match ($type) {
            Reminder::ENTITY_DEAL => route('deals.show', $id),
            Reminder::ENTITY_LEAD => route('lead-contact.show', $id),
            Reminder::ENTITY_PROPERTY => route('properties.show', $id),
            Reminder::ENTITY_DEVELOPER_PROJECT => route('developer-projects.show', $id),
            Reminder::ENTITY_UNIT => $this->resolveUnitUrl($id),
            Reminder::ENTITY_FLIGHT_ITINERARY => $this->resolveFlightItineraryUrl($id),
            default => url('/'),
        };

        return $this->company ? getDomainSpecificUrl($url, $this->company) : $url;
    }

    private function resolveUnitUrl(int $unitTypeId): string
    {
        $unitType = \App\Models\DeveloperProjectUnitType::query()->find($unitTypeId);
        if ($unitType?->developer_project_id) {
            return route('developer-projects.show', $unitType->developer_project_id);
        }

        return url('/');
    }

    private function resolveFlightItineraryUrl(int $itineraryId): string
    {
        $leg = \App\Models\LeadFlightItinerary::query()->find($itineraryId);
        if ($leg?->deal_id) {
            return route('deals.show', $leg->deal_id).'?tab=itinerary';
        }
        if ($leg?->lead_id) {
            return route('lead-contact.show', $leg->lead_id);
        }

        return url('/');
    }

    private function resolveGenericEntityMessage(string $title, ?CarbonInterface $eventAt, string $countdown): string
    {
        if ($eventAt === null) {
            return $title;
        }

        $langPrefix = match ($this->reminder->entity_type) {
            Reminder::ENTITY_DEAL => 'email.dealReminder',
            Reminder::ENTITY_LEAD => 'email.leadReminder',
            Reminder::ENTITY_PROPERTY => 'email.propertyReminder',
            Reminder::ENTITY_DEVELOPER_PROJECT => 'email.developerProjectReminder',
            Reminder::ENTITY_UNIT => 'email.unitReminder',
            Reminder::ENTITY_FLIGHT_ITINERARY => 'email.flightReminder',
            default => 'email.dealReminder',
        };

        $secondsUntil = $eventAt->getTimestamp() - now()->getTimestamp();
        if ($secondsUntil <= 0) {
            $template = __($langPrefix.'.dueNow');
            if (! str_contains($template, ':title')) {
                $template = '":title" is due now.';
            }

            return str_replace(':title', $title, $template);
        }

        $countdownText = $countdown !== '' ? $countdown : 'less than a minute';
        $template = __($langPrefix.'.dueCountdown');
        if (! str_contains($template, ':countdown')) {
            $template = '":title" is coming up in :countdown.';
        }

        return str_replace(
            [':title', ':countdown'],
            [$title, $countdownText],
            $template
        );
    }

    private function resolveTaskMessage(string $heading, ?CarbonInterface $dueAt, string $countdown): string
    {
        if ($dueAt === null) {
            return $heading;
        }

        $secondsUntil = $dueAt->getTimestamp() - now()->getTimestamp();
        if ($secondsUntil <= 0) {
            $template = __('email.taskReminder.dueNow');
            if (! str_contains($template, ':heading')) {
                $template = 'Task ":heading" is due now.';
            }

            return str_replace(':heading', $heading, $template);
        }

        $countdownText = $countdown !== '' ? $countdown : 'less than a minute';
        $template = __('email.taskReminder.dueCountdown');
        if (! str_contains($template, ':countdown')) {
            $template = 'Task ":heading" is due in :countdown.';
        }

        return str_replace(
            [':heading', ':countdown'],
            [$heading, $countdownText],
            $template
        );
    }

    private function resolveNoteMessage(string $title, ?CarbonInterface $remindAt, string $countdown): string
    {
        if ($remindAt === null) {
            return $title;
        }

        $secondsUntil = $remindAt->getTimestamp() - now()->getTimestamp();
        if ($secondsUntil <= 0) {
            $template = __('email.noteReminder.dueNow');
            if (! str_contains($template, ':title')) {
                $template = 'Reminder for note ":title" is due now.';
            }

            return str_replace(':title', $title, $template);
        }

        $countdownText = $countdown !== '' ? $countdown : 'less than a minute';
        $template = __('email.noteReminder.dueCountdown');
        if (! str_contains($template, ':countdown')) {
            $template = 'Reminder for note ":title" in :countdown.';
        }

        return str_replace(
            [':title', ':countdown'],
            [$title, $countdownText],
            $template
        );
    }

    private function noteExcerpt(string $details): string
    {
        $text = trim(html_entity_decode(strip_tags($details), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($text === '') {
            return '';
        }

        return \Illuminate\Support\Str::limit($text, 160);
    }

    private function countdownUntil(CarbonInterface $at): string
    {
        $secondsUntil = $at->getTimestamp() - now()->getTimestamp();

        if ($secondsUntil <= 0) {
            return '';
        }

        $totalMinutes = max(1, (int) ceil($secondsUntil / 60));

        return CarbonInterval::minutes($totalMinutes)
            ->cascade()
            ->forHumans(['parts' => 2, 'short' => false, 'join' => ' ']);
    }

    private function resolveLeadForMeetingMail(DealFollowUp $followUp): ?Lead
    {
        if ($this->reminder->recipient_id) {
            return Lead::query()->find($this->reminder->recipient_id);
        }

        return $followUp->lead ?? $followUp->deal?->contact;
    }

    private function resolveFollowUp(): ?DealFollowUp
    {
        if ($this->followUpLoaded) {
            return $this->followUp;
        }

        $this->followUpLoaded = true;

        if ($this->reminder->entity_type === Reminder::ENTITY_MEETING && $this->reminder->entity_id) {
            $this->followUp = DealFollowUp::with(['deal.contact', 'deal.leadAgent.user', 'lead', 'addedBy'])
                ->find($this->reminder->entity_id);
        }

        return $this->followUp;
    }

    private function resolveTask(): ?Task
    {
        if ($this->taskLoaded) {
            return $this->task;
        }

        $this->taskLoaded = true;

        if ($this->reminder->entity_type === Reminder::ENTITY_TASK && $this->reminder->entity_id) {
            $this->task = Task::query()->find($this->reminder->entity_id);
        }

        return $this->task;
    }

    private function resolveNote(): DealNote|LeadNote|null
    {
        if ($this->noteLoaded) {
            return $this->note;
        }

        $this->noteLoaded = true;

        if ($this->reminder->entity_type === Reminder::ENTITY_DEAL_NOTE && $this->reminder->entity_id) {
            $this->note = DealNote::with('deal')->find($this->reminder->entity_id);
        } elseif ($this->reminder->entity_type === Reminder::ENTITY_LEAD_NOTE && $this->reminder->entity_id) {
            $this->note = LeadNote::with('lead')->find($this->reminder->entity_id);
        }

        return $this->note;
    }
}
