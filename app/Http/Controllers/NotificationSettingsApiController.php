<?php

namespace App\Http\Controllers;

use App\Models\PushNotificationSetting;
use App\Models\SlackSetting;
use App\Services\NotificationSettingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use InvalidArgumentException;

/**
 * JSON API backing the React notification-settings page (Settings/NotificationSettings.tsx).
 * Mirrors the legacy Blade notification-settings tabs so both UIs manage the same
 * EmailNotificationSetting rows, gated by the same permission.
 */
class NotificationSettingsApiController extends AccountBaseController
{
    public function __construct(private readonly NotificationSettingsService $settingsService)
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_notification_setting') !== 'all');

            return $next($request);
        });
    }

    public function page()
    {
        return Inertia::render('Settings/NotificationSettings', [
            'pageTitle' => __('app.menu.notificationSettings'),
        ]);
    }

    public function index()
    {
        $slackSetting = SlackSetting::first();
        $pushSetting = PushNotificationSetting::first();

        return response()->json([
            'status' => 'success',
            'data' => [
                'settings' => $this->settingsService->getAllSettings(),
                'statuses' => [
                    'slack' => $slackSetting?->status === 'active',
                    'onesignal' => $pushSetting?->status === 'active',
                    'beams' => $pushSetting?->beams_push_status === 'active',
                ],
            ],
        ]);
    }

    public function update(Request $request, string $channel)
    {
        $request->validate([
            'enabled_ids' => ['array'],
            'enabled_ids.*' => ['integer'],
        ]);

        try {
            $column = $this->settingsService->columnForChannel($channel);
        } catch (InvalidArgumentException) {
            return response()->json([
                'status' => 'fail',
                'message' => __('messages.somethingWentWrong'),
            ], 404);
        }

        $this->settingsService->updateChannelToggles($column, $request->input('enabled_ids', []));

        session()->forget('email_notification_setting');

        return response()->json([
            'status' => 'success',
            'message' => __('messages.updateSuccess'),
        ]);
    }
}
