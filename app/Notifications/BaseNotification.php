<?php

namespace App\Notifications;

use App\Models\GlobalSetting;
use App\Models\SmtpSetting;
use App\Support\FeatureFlags;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Messages\SlackMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;
use Symfony\Component\Mime\Email;

class BaseNotification extends Notification implements ShouldQueue
{

    use Queueable, Dispatchable;

    protected $company = null;
    protected $slack = null;
    protected bool $suppressBulkTransactionalEmails = false;
    // Resolved at HTTP dispatch time so queue workers don't call the flag service.
    protected bool $unsRoutingEnabled = false;

    protected function initUnsRouting(): void
    {
        $this->unsRoutingEnabled = FeatureFlags::enabled('crm.notification-service-routing');
    }

    /**
     * Attach a Plunk template ID and variables to the mail message via custom
     * Symfony headers so UnsEmailPayloadMapper can switch to templateSlug mode.
     * The headers are harmless on the SMTP fallback path — they're just ignored.
     *
     * @param array<string, mixed> $variables
     */
    protected function attachPlunkTemplate(MailMessage $build, string $templateId, array $variables): void
    {
        $build->withSymfonyMessage(function (Email $message) use ($templateId, $variables): void {
            $message->getHeaders()->addTextHeader('X-Plunk-Template-Id', $templateId);
            $message->getHeaders()->addTextHeader('X-Plunk-Template-Variables', base64_encode((string) json_encode($variables)));
        });
    }

    /**
     * A short, labeled snippet from the entity's already-generated AI summary
     * (status_line), for folding into an assignment notification instead of
     * pure boilerplate. Read-only lookup — never triggers generation, since
     * that's an explicit user action (rate-limited, on-demand) elsewhere.
     * Returns null whenever no summary has been generated yet for this
     * entity, which is the common case for a newly created lead/deal.
     */
    protected function aiSummarySnippet(\App\Models\Deal|\App\Models\Lead $entity, int $maxLength = 110): ?string
    {
        try {
            $summary = $entity instanceof \App\Models\Deal
                ? app(\App\Services\EntitySummary\DealSummaryService::class)->getCached($entity)
                : app(\App\Services\EntitySummary\LeadSummaryService::class)->getCached($entity);
        } catch (\Throwable) {
            return null;
        }

        $statusLine = trim((string) ($summary['status_line'] ?? ''));
        if ($statusLine === '') {
            return null;
        }

        return 'AI Summary: '.\Illuminate\Support\Str::limit($statusLine, $maxLength);
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
            App::setLocale($locale ?? (!is_null($company) ? $company->locale : 'en'));
        }
        else {
            App::setLocale(session('locale') ?: $globalSetting->locale);
        }

        // Retrieve SMTP settings
        $smtpSetting = SmtpSetting::first();

        // Initialize a mail message instance
        $build = (new MailMessage);

        if ($this->unsRoutingEnabled) {
            $build->withSymfonyMessage(static function (Email $message): void {
                $message->getHeaders()->addTextHeader('X-Uns-Route', 'true');
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
        if (!is_null($company)) {
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
        return (new SlackMessage())
            ->from($notifiable->company->company_name) // Set the sender name
            ->to('@' . $notifiable->employeeDetail->slack_username) // Set the recipient's Slack username
            ->image(asset_url_local_s3('slack-logo/' . $slack->slack_logo)); // Set the image for Slack message
    }

    /**
     * Create a Slack message for redirected notifications.
     */
    protected function slackRedirectMessage($subjectKey, $notifiable)
    {
        try {
            // Build a Slack message using the slackBuild function
            return $this->slackBuild($notifiable)
                ->content('*' . __($subjectKey) . '*' . "\n" . 'This is a redirected notification. Add slack username for *' . $notifiable->name . '*');
        } catch (\Exception $e) {
            // Catch and display any exceptions occurred
            echo $e->getMessage();
        }
    }

    /**
     * Check if the notifiable has a Slack username.
     *
     * @param mixed $notifiable
     * @return bool
     */
    protected function slackUserNameCheck($notifiable): bool
    {
        if (!isset($notifiable->employeeDetail)) {
            return false;
        }

        if (is_array($notifiable->employee)) {
            if (count($notifiable->employee) == 0) {
                return false;
            }
        }

        // Check if the notifiable a non-empty Slack username
        return (!is_null($notifiable->employeeDetail->slack_username) && ($notifiable->employeeDetail->slack_username != ''));
    }

    public function resetLocale()
    {
        // Set the company and global settings
        $company = $this->company;
        $globalSetting = GlobalSetting::first();

        // Set the application locale based on the company's locale or global settings
        if (!is_null($company)) {
            App::setLocale($company->locale ?? 'en');
        }
        else {
            App::setLocale(session('locale') ?: $globalSetting->locale);
        }
    }

}
