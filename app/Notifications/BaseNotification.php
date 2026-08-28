<?php

namespace App\Notifications;

use App\Models\GlobalSetting;
use App\Models\SmtpSetting;
use App\Services\Notifications\UnsEmailPayloadMapper;
use App\Support\FeatureFlags;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Messages\SlackMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Symfony\Component\Mime\Email;

class BaseNotification extends Notification implements ShouldQueue
{
    use Dispatchable, Queueable;

    protected $company = null;

    protected $slack = null;

    protected bool $suppressBulkTransactionalEmails = false;

    // Resolved at HTTP dispatch time so queue workers don't call the flag service.
    protected bool $unsRoutingEnabled = false;

    /** Captured at construct time — queue workers have no auth user. */
    protected ?int $triggeredByUserId = null;

    /** Stable for the lifetime of this queued notification instance (retries reuse it). */
    protected ?string $unsIdempotencyKey = null;

    protected function initUnsRouting(): void
    {
        $this->unsRoutingEnabled = FeatureFlags::enabled('crm.notification-service-routing');
    }

    /**
     * Route task notification email through UNS/Plunk regardless of the global flag.
     */
    protected function initTaskMailRouting(): void
    {
        $this->initUnsRouting();
        $this->unsRoutingEnabled = true;
    }

    /**
     * Always route entity reminder mail through UNS/Plunk — do not fall back to SMTP
     * when crm.notification-service-routing is off.
     */
    protected function forceUnsRouting(): void
    {
        $this->unsRoutingEnabled = true;
    }

    /**
     * Remember who triggered this notification (current user by default).
     * Call from constructors so queued via() can still skip the actor.
     */
    protected function captureTriggeredByUser(?int $userId = null): void
    {
        $id = $userId ?? user()?->id;
        $this->triggeredByUserId = $id !== null ? (int) $id : null;
    }

    /**
     * True when the notifiable is the same user who triggered the action.
     * Applies to admins too — actors should not notify themselves.
     */
    protected function isTriggeredByNotifiable(mixed $notifiable): bool
    {
        if ($this->triggeredByUserId === null || ! is_object($notifiable) || ! isset($notifiable->id)) {
            return false;
        }

        return (int) $notifiable->id === $this->triggeredByUserId;
    }

    /**
     * Optional prefix for UNS idempotency keys (e.g. crm-reminder-26).
     * When null, defaults to the notification class name.
     */
    protected function unsIdempotencyPrefix(): ?string
    {
        return null;
    }

    protected function resolveUnsIdempotencyKey(): string
    {
        if ($this->unsIdempotencyKey === null) {
            $prefix = $this->unsIdempotencyPrefix() ?? 'crm-'.Str::kebab(class_basename(static::class));
            $this->unsIdempotencyKey = $prefix.'-'.Str::uuid()->toString();
        }

        return $this->unsIdempotencyKey;
    }

    /**
     * Attach a per-dispatch UNS idempotency key so distinct sends never collide
     * on recipient + subject + template. Retries of the same queued job reuse
     * the key captured on the notification instance.
     */
    protected function attachUnsIdempotencyKey(MailMessage $build): void
    {
        if (! $this->unsRoutingEnabled) {
            return;
        }

        $key = $this->resolveUnsIdempotencyKey();
        $build->withSymfonyMessage(static function (Email $message) use ($key): void {
            if ($message->getHeaders()->has(UnsEmailPayloadMapper::IDEMPOTENCY_HEADER)) {
                return;
            }

            $message->getHeaders()->addTextHeader(UnsEmailPayloadMapper::IDEMPOTENCY_HEADER, $key);
        });
    }

    /**
     * Attach a Plunk template ID and variables to the mail message via custom
     * Symfony headers so UnsEmailPayloadMapper can switch to templateSlug mode.
     * The headers are harmless on the SMTP fallback path — they're just ignored.
     *
     * @param  array<string, mixed>  $variables
     */
    protected function attachPlunkTemplate(MailMessage $build, string $templateId, array $variables): void
    {
        $build->withSymfonyMessage(function (Email $message) use ($templateId, $variables): void {
            $message->getHeaders()->addTextHeader('X-Plunk-Template-Id', $templateId);
            $message->getHeaders()->addTextHeader('X-Plunk-Template-Variables', base64_encode((string) json_encode($variables)));
        });
    }

    /**
     * Attach shared entity-activity Plunk template (deal / lead / property / task).
     * HTML: resources/views/mail/plunk/entity-activity.plunk.html
     *
     * @param  array<string, mixed>  $variables
     */
    protected function attachEntityActivityPlunk(MailMessage $build, array $variables): void
    {
        $templateId = config('email.plunk_template_ids.entity_activity');
        if (empty($templateId)) {
            return;
        }

        $this->attachPlunkTemplate($build, (string) $templateId, array_merge([
            'currentYear' => (string) date('Y'),
            'appName' => config('app.name'),
        ], $variables));
    }

    /**
     * Attach task lifecycle Plunk template (created / updated / due / completed).
     * HTML: resources/views/mail/task/task-lifecycle.plunk.html
     *
     * @param  array<string, mixed>  $variables
     */
    protected function attachTaskLifecyclePlunk(MailMessage $build, array $variables): void
    {
        $templateId = config('email.plunk_template_ids.task_lifecycle');
        if (empty($templateId)) {
            return;
        }

        $this->attachPlunkTemplate($build, (string) $templateId, array_merge([
            'currentYear' => (string) date('Y'),
            'appName' => config('app.name'),
        ], $variables));
    }

    /**
     * Attach exposé-ready Plunk template.
     * HTML: resources/views/mail/plunk/expose-ready.plunk.html
     *
     * @param  array<string, mixed>  $variables
     */
    protected function attachExposeReadyPlunk(MailMessage $build, array $variables): void
    {
        $templateId = config('email.plunk_template_ids.expose_ready');
        if (empty($templateId)) {
            return;
        }

        $this->attachPlunkTemplate($build, (string) $templateId, array_merge([
            'currentYear' => (string) date('Y'),
            'appName' => config('app.name'),
        ], $variables));
    }

    /**
     * Attach deal close-date approaching Plunk template.
     *
     * @param  array<string, mixed>  $variables
     */
    protected function attachDealCloseDateApproachingPlunk(MailMessage $build, array $variables): void
    {
        $templateId = config('email.plunk_template_ids.deal_close_date_approaching');
        if (empty($templateId)) {
            return;
        }

        $this->attachPlunkTemplate($build, (string) $templateId, array_merge([
            'currentYear' => (string) date('Y'),
            'appName' => config('app.name'),
        ], $variables));
    }

    /**
     * Attach deal deleted Plunk template.
     *
     * @param  array<string, mixed>  $variables
     */
    protected function attachDealDeletedPlunk(MailMessage $build, array $variables): void
    {
        $templateId = config('email.plunk_template_ids.deal_deleted');
        if (empty($templateId)) {
            return;
        }

        $this->attachPlunkTemplate($build, (string) $templateId, array_merge([
            'currentYear' => (string) date('Y'),
            'appName' => config('app.name'),
        ], $variables));
    }

    /**
     * Attach property workflow REQUEST Plunk template (approve / review CTAs).
     * HTML: resources/views/mail/plunk/property-request.plunk.html
     *
     * @param  array<string, mixed>  $variables
     */
    protected function attachPropertyRequestPlunk(MailMessage $build, array $variables): void
    {
        $templateId = config('email.plunk_template_ids.property_request');
        if (empty($templateId)) {
            return;
        }

        $this->attachPlunkTemplate($build, (string) $templateId, array_merge([
            'currentYear' => (string) date('Y'),
            'appName' => config('app.name'),
            'footerNote' => '',
        ], $variables));
    }

    /**
     * Attach property workflow REVIEWED Plunk template (outcomes).
     * HTML: plunk/property-request-reviewed.plunk.html (same layout as entity-activity).
     *
     * @param  array<string, mixed>  $variables
     */
    protected function attachPropertyRequestReviewedPlunk(MailMessage $build, array $variables): void
    {
        $actionText = trim((string) ($variables['actionText'] ?? ''));
        $entityUrl = trim((string) ($variables['entityUrl'] ?? ''));

        if ($actionText === '' || $entityUrl === '' || $entityUrl === '#') {
            return;
        }

        $templateId = config('email.plunk_template_ids.property_request_reviewed')
            ?: config('email.plunk_template_ids.entity_activity');

        if (empty($templateId)) {
            return;
        }

        $this->attachPlunkTemplate($build, (string) $templateId, array_merge([
            'currentYear' => (string) date('Y'),
            'appName' => config('app.name'),
        ], $variables));
    }

    /**
     * A short, labeled snippet from the entity's already-generated AI summary
     * (status_line), for folding into an assignment notification instead of
     * pure boilerplate. Read-only lookup — never triggers generation, since
     * that's an explicit user action (rate-limited, on-demand) elsewhere.
     * Returns null whenever no summary has been generated yet for this
     * entity, which is the common case for a newly created lead/deal.
     *
     * Important: do NOT call getCached()/enrichSummary() here. Those hydrate the
     * full summary_json (and stale-hash work) into PHP — staging has seen that
     * OOM the 128MB queue worker during mail render.
     */
    protected function aiSummarySnippet(\App\Models\Deal|\App\Models\Lead $entity, int $maxLength = 110): ?string
    {
        $companyId = $entity->company_id ?? null;
        $entityId = $entity->id ?? null;

        if (! $companyId || ! $entityId) {
            return null;
        }

        $entityType = $entity instanceof \App\Models\Deal
            ? \App\Models\EntityAiSummary::TYPE_DEAL
            : \App\Models\EntityAiSummary::TYPE_LEAD;

        return $this->aiSummarySnippetFor((int) $companyId, $entityType, (int) $entityId, $maxLength);
    }

    /**
     * Fetch only status_line (capped in SQL) — never the full summary_json blob.
     */
    protected function aiSummarySnippetFor(int $companyId, string $entityType, int $entityId, int $maxLength = 110): ?string
    {
        try {
            $driver = \App\Models\EntityAiSummary::query()->getConnection()->getDriverName();
            $query = \App\Models\EntityAiSummary::query()
                ->where('company_id', $companyId)
                ->where('entity_type', $entityType)
                ->where('entity_id', $entityId);

            if (in_array($driver, ['mysql', 'mariadb'], true)) {
                $statusLine = $query->value(\Illuminate\Support\Facades\DB::raw(
                    "LEFT(JSON_UNQUOTE(JSON_EXTRACT(summary_json, '$.status_line')), 500)"
                ));
            } elseif ($driver === 'sqlite') {
                $statusLine = $query->value(\Illuminate\Support\Facades\DB::raw(
                    "substr(json_extract(summary_json, '$.status_line'), 1, 500)"
                ));
            } else {
                // Last resort: still avoid casting the whole JSON column via the model.
                $statusLine = $query->toBase()->value(\Illuminate\Support\Facades\DB::raw(
                    'summary_json'
                ));
                if (is_string($statusLine) && $statusLine !== '') {
                    $decoded = json_decode(
                        strlen($statusLine) > 8192 ? substr($statusLine, 0, 8192) : $statusLine,
                        true
                    );
                    $statusLine = is_array($decoded) ? ($decoded['status_line'] ?? '') : '';
                }
            }
        } catch (\Throwable) {
            return null;
        }

        $statusLine = $this->safeMailText($statusLine ?? '', 500);
        if ($statusLine === '') {
            return null;
        }

        return __('email.aiSummary.prefix').\Illuminate\Support\Str::limit($statusLine, $maxLength);
    }

    /**
     * Cap user/entity text before it enters mail/preheader rendering.
     * Staging has seen multi‑hundred‑MB field values that OOM PHP during Blade sanitize.
     */
    protected function safeMailText(mixed $value, int $maxBytes = 200): string
    {
        // Avoid (string) cast on non-strings first when value is already a huge string —
        // substr before any further copies. For non-strings, cast then cap.
        if (is_string($value)) {
            $text = $value;
        } elseif ($value === null) {
            return '';
        } else {
            $text = (string) $value;
        }

        if ($text !== '' && strlen($text) > $maxBytes) {
            $text = substr($text, 0, $maxBytes);
        }

        return trim($text);
    }

    /**
     * Inbox preheader — always short; never pass unbounded HTML/body into templates.
     */
    protected function safePreheader(mixed $value, int $maxChars = 90): string
    {
        return \App\Support\MailPreheader::sanitize($value, $maxChars);
    }

    /**
     * Ensure the first letter of each sentence starts with a capital letter.
     */
    protected function capitalizeSentences(string $text): string
    {
        return \App\Support\MailText::capitalizeSentences($text);
    }

    public function setSuppressBulkTransactionalEmails(bool $value = true): static
    {
        $this->suppressBulkTransactionalEmails = $value;

        return $this;
    }

    public static function applySuppressionFromContainer(Notification $notification): Notification
    {
        $shouldSuppress = app()->bound('suppress_bulk_notifications')
            && app('suppress_bulk_notifications') === true;

        if ($shouldSuppress && $notification instanceof self) {
            $notification->setSuppressBulkTransactionalEmails(true);
        }

        return $notification;
    }

    /**
     * Create a new notification instance.
     *
     * @return MailMessage
     */

    /**
     * Build a mail message with proper configuration settings.
     *
     * This method sets up the mail message according to the configured settings
     * for the company or global settings.
     *
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function build($notifiable = null)
    {
        // Set the company and global settings
        $company = $this->company;
        $globalSetting = GlobalSetting::first();

        $locale = $notifiable->locale ?? 'en';

        // Set the application locale based on the company's locale or global settings
        if (isset($locale)) {
            App::setLocale($locale ?? (! is_null($company) ? $company->locale : 'en'));
        } else {
            App::setLocale(session('locale') ?: $globalSetting->locale);
        }

        // Retrieve SMTP settings
        $smtpSetting = SmtpSetting::first();

        // Initialize a mail message instance
        $build = (new MailMessage);

        if ($this->unsRoutingEnabled) {
            $idempotencyKey = $this->resolveUnsIdempotencyKey();
            $build->withSymfonyMessage(static function (Email $message) use ($idempotencyKey): void {
                $message->getHeaders()->addTextHeader('X-Uns-Route', 'true');
                $message->getHeaders()->addTextHeader(UnsEmailPayloadMapper::IDEMPOTENCY_HEADER, $idempotencyKey);
            });
        }

        // Set default reply name and email to SMTP settings
        $replyName = $companyName = $smtpSetting->mail_from_name;
        $replyEmail = $companyEmail = $smtpSetting->mail_from_email;

        // Set the application logo URL from the global settings
        Config::set('app.logo', $globalSetting->masked_logo_url);
        Config::set('app.name', $companyName);

        // If the application is Worksuite, return the mail message with SMTP settings
        if (isWorksuite()) {
            return $build->from($companyEmail, $companyName);
        }

        // If a company is specified, customize the reply name, email, logo URL, and application name
        if (! is_null($company)) {
            $replyName = $company->company_name;
            $replyEmail = $company->company_email;
            Config::set('app.logo', $company->masked_logo_url);
            Config::set('app.name', $replyName);
        }

        // Ensure that the company email and name are used if mail verification is successful
        $companyEmail = config('mail.verified') === true ? $companyEmail : $replyEmail;
        //        $companyName = config('mail.verified') === true ? $companyName : $replyName;

        // Return the mail message with configured from and replyTo settings
        return $build->from($companyEmail, $replyName)->replyTo($replyEmail, $replyName);
    }

    protected function modifyUrl($url)
    {
        return getDomainSpecificUrl($url, $this->company);
    }

    /**
     * Build a Slack message for notification.
     */
    protected function slackBuild($notifiable): SlackMessage
    {
        // Retrieve Slack settings for the company
        $slack = $notifiable->company->slackSetting;

        // Compose and return a Slack message
        return (new SlackMessage)
            ->from($notifiable->company->company_name) // Set the sender name
            ->to('@'.$notifiable->employeeDetail->slack_username) // Set the recipient's Slack username
            ->image(asset_url_local_s3('slack-logo/'.$slack->slack_logo)); // Set the image for Slack message
    }

    /**
     * Create a Slack message for redirected notifications.
     */
    protected function slackRedirectMessage($subjectKey, $notifiable)
    {
        try {
            // Build a Slack message using the slackBuild function
            return $this->slackBuild($notifiable)
                ->content('*'.__($subjectKey).'*'."\n".'This is a redirected notification. Add slack username for *'.$notifiable->name.'*');
        } catch (\Exception $e) {
            // Catch and display any exceptions occurred
            echo $e->getMessage();
        }
    }

    /**
     * Resolve via() channels through the shared NotificationChannelResolver, using
     * this notification's own company/Slack-eligibility context.
     *
     * @param  mixed  $notifiable
     * @return array<int, string>
     */
    protected function resolveChannels(?\App\Models\EmailNotificationSetting $setting, $notifiable): array
    {
        $slackEligible = (bool) ($setting
            && $this->company?->slackSetting?->status === 'active'
            && $this->slackUserNameCheck($notifiable));

        return app(\App\Services\NotificationChannelResolver::class)->resolve($setting, $notifiable, $slackEligible);
    }

    /**
     * Check if the notifiable has a Slack username.
     *
     * @param  mixed  $notifiable
     */
    protected function slackUserNameCheck($notifiable): bool
    {
        if (! isset($notifiable->employeeDetail)) {
            return false;
        }

        if (is_array($notifiable->employee)) {
            if (count($notifiable->employee) == 0) {
                return false;
            }
        }

        // Check if the notifiable a non-empty Slack username
        return ! is_null($notifiable->employeeDetail->slack_username) && ($notifiable->employeeDetail->slack_username != '');
    }

    public function resetLocale()
    {
        // Set the company and global settings
        $company = $this->company;
        $globalSetting = GlobalSetting::first();

        // Set the application locale based on the company's locale or global settings
        if (! is_null($company)) {
            App::setLocale($company->locale ?? 'en');
        } else {
            App::setLocale(session('locale') ?: $globalSetting->locale);
        }
    }
}
