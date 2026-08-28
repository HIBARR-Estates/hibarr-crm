<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\User\UpdatePreferencesTimezoneRequest;
use App\Models\UserNotificationAlertSetting;
use App\Models\UserNotificationBypass;
use App\Support\FeatureFlags;
use App\Support\NotificationBypass;
use App\Support\NotificationBypassCatalog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UserPreferencesController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.settings.preferences';
        $this->activeSettingMenu = 'user_preferences';

        $this->middleware(function ($request, $next) {
            abort_403(! in_array('employees', $this->user->modules));

            return $next($request);
        });
    }

    public function show()
    {
        $user = user();
        $bypassEnabled = FeatureFlags::enabled(NotificationBypass::FLAG);

        return Inertia::render('Settings/Preferences', [
            'pageTitle' => __('app.settings.preferences'),
            'timezone' => $user->timezone,
            'timezoneLocked' => (bool) $user->timezone_locked,
            'alertSettings' => UserNotificationAlertSetting::forUser((int) $user->id),
            'bypassEnabled' => $bypassEnabled,
            'bypassTypes' => $bypassEnabled ? NotificationBypassCatalog::types() : [],
            'bypassedKeys' => $bypassEnabled ? NotificationBypass::keysForUser((int) $user->id) : [],
        ]);
    }

    public function updateTimezone(UpdatePreferencesTimezoneRequest $request)
    {
        $user = user();
        $timezone = $request->validated('timezone');
        $locked = $request->boolean('locked');

        $user->timezone = $timezone;
        $user->timezone_locked = $locked;
        $user->save();
        session()->forget('user');

        return Reply::successWithData(__('messages.updateSuccess'), [
            'timezone' => $user->timezone,
            'timezoneLocked' => (bool) $user->timezone_locked,
        ]);
    }

    public function updateBypass(Request $request)
    {
        $validated = $request->validate([
            'key' => ['required', 'string', 'max:128'],
            'bypassed' => ['required', 'boolean'],
        ]);

        if (! FeatureFlags::enabled(NotificationBypass::FLAG)) {
            return response()->json(Reply::error(__('messages.errorOccured')), 403);
        }

        $key = $validated['key'];

        if (! NotificationBypassCatalog::isBypassable($key)) {
            return response()->json(Reply::error(__('messages.errorOccured')), 422);
        }

        $userId = (int) user()->id;
        $bypassed = (bool) $validated['bypassed'];

        if ($bypassed) {
            UserNotificationBypass::query()->firstOrCreate([
                'user_id' => $userId,
                'notification_key' => $key,
            ]);
        } else {
            UserNotificationBypass::query()
                ->where('user_id', $userId)
                ->where('notification_key', $key)
                ->delete();
        }

        return Reply::successWithData(__('messages.updateSuccess'), [
            'key' => $key,
            'bypassed' => $bypassed,
        ]);
    }
}
