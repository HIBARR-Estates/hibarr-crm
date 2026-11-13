<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Email\EmailFeature;
use App\Http\Controllers\AccountBaseController;
use App\Models\UserReminderPreference;
use App\Support\FeatureFlags;
use App\Support\NotificationBypass;
use App\Support\NotificationBypassCatalog;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Preferences for the agent workspace (L7-40): the classic Preferences page
 * (timezone, in-app alerts, which events notify you) and Reminder preferences
 * (meeting reminders) on one page. Saving goes to those pages' own endpoints,
 * so the two screens always agree; this only gathers what they read.
 */
class PreferencesController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(! in_array('employees', $this->user->modules));

            return $next($request);
        });
    }

    public function show(): Response
    {
        $user = user();

        return Inertia::render('AgentWorkspace/Preferences', [
            'pageTitle' => __('app.settings.preferences'),
            'timezone' => $user->timezone,
            'timezoneLocked' => (bool) $user->timezone_locked,
            'links' => [
                'notificationSettings' => $user->permission('manage_notification_setting') === 'all'
                    ? route('notification-settings-manager.index')
                    : null,
                'mailbox' => EmailFeature::enabledFor($user) ? route('mailbox-settings.show') : null,
            ],
            'reminders' => Inertia::defer(fn () => $this->reminders((int) $user->id), 'reminders'),
            'notifications' => Inertia::defer(fn () => $this->notifications((int) $user->id), 'notifications'),
        ]);
    }

    /** The meeting reminders as the classic Reminder preferences page reads them. */
    private function reminders(int $userId): array
    {
        $existing = UserReminderPreference::query()
            ->where('user_id', $userId)
            ->where('entity_type', 'meeting')
            ->first();

        return [
            'reminders' => $existing?->reminders ?? UserReminderPreference::DEFAULT_REMINDERS,
            'isActive' => $existing?->is_active ?? true,
            'defaults' => UserReminderPreference::DEFAULT_REMINDERS,
        ];
    }

    /** The event types the person can switch off, when the notification bypass is on. */
    private function notifications(int $userId): array
    {
        $enabled = FeatureFlags::enabled(NotificationBypass::FLAG);

        return [
            'bypassEnabled' => $enabled,
            'bypassTypes' => $enabled ? NotificationBypassCatalog::types() : [],
            'bypassedKeys' => $enabled ? NotificationBypass::keysForUser($userId) : [],
        ];
    }
}
