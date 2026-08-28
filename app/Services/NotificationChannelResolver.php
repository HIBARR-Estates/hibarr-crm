<?php

namespace App\Services;

use App\Models\EmailNotificationSetting;
use App\Notifications\Channels\BeamsPushChannel;
use NotificationChannels\OneSignal\OneSignalChannel;

/**
 * Central place notification classes ask "which channels should this go out on?"
 * given a company's per-type EmailNotificationSetting row. Keeping this as a plain,
 * stateless service (rather than logic duplicated inline in each notification's
 * via()) is what makes the in-app/email/slack/push toggles actually testable.
 */
class NotificationChannelResolver
{
    /**
     * @param  mixed  $notifiable
     * @param  bool  $slackEligible  Precomputed by the caller — whether this notifiable
     *                                can receive Slack at all (company Slack active +
     *                                notifiable has a Slack username). The resolver has
     *                                no access to that notification-instance context.
     * @return list<string|class-string>
     */
    public function resolve(?EmailNotificationSetting $setting, $notifiable, bool $slackEligible = false): array
    {
        if (! $setting) {
            // No row for this slug/company — fail open on in-app only, matching the
            // existing convention elsewhere (e.g. DealActivityNotification) rather
            // than silently dropping the notification entirely.
            return ['database'];
        }

        $via = [];

        if ($setting->send_database === 'yes') {
            $via[] = 'database';
        }

        if (
            $setting->send_email === 'yes'
            && ! empty($notifiable->email_notifications)
            && filled($notifiable->email ?? null)
        ) {
            $via[] = 'mail';
        }

        if ($setting->send_slack === 'yes' && $slackEligible) {
            $via[] = 'slack';
        }

        if ($setting->send_push === 'yes' && push_setting()->status === 'active') {
            $via[] = OneSignalChannel::class;
        }

        if (
            $setting->send_push === 'yes'
            && push_setting()->beams_push_status === 'active'
            && isset($notifiable->id)
        ) {
            $via[] = BeamsPushChannel::class;
        }

        return $via;
    }
}
