<?php

namespace App\Http\Controllers;

use App\Support\MeetingAttendanceConfirmationFeature;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * JSON API backing the React meeting-attendance-confirmation settings page
 * (Settings/MeetingAttendanceConfirmationSettings.tsx). Mirrors the same
 * delay/snooze fields on the legacy Blade Company Settings page — both UIs
 * manage the same companies.meeting_attendance_confirmation_* columns.
 */
class MeetingAttendanceConfirmationSettingsApiController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function page()
    {
        return Inertia::render('Settings/MeetingAttendanceConfirmationSettings', [
            'pageTitle' => __('app.menu.meetings'),
            'settings' => Inertia::defer(fn () => $this->settingsData()),
        ]);
    }

    public function index()
    {
        return response()->json([
            'status' => 'success',
            'data' => $this->settingsData(),
        ]);
    }

    private function settingsData(): array
    {
        $company = \company();

        return [
            'delay_minutes' => $company->meeting_attendance_confirmation_delay_minutes,
            'snooze_minutes' => $company->meeting_attendance_confirmation_snooze_minutes,
            'default_delay_minutes' => (int) config('meetings.attendance_confirmation_delay_minutes', 5),
            'default_snooze_minutes' => (int) config('meetings.attendance_confirmation_snooze_minutes', 60),
        ];
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'delay_minutes' => 'nullable|integer|min:1|max:1440',
            'snooze_minutes' => 'nullable|integer|min:1|max:1440',
        ]);

        $company = \company();
        $company->meeting_attendance_confirmation_delay_minutes = $validated['delay_minutes'] ?? null;
        $company->meeting_attendance_confirmation_snooze_minutes = $validated['snooze_minutes'] ?? null;
        $company->save();

        MeetingAttendanceConfirmationFeature::clearActivationCache((int) $company->id);

        return response()->json([
            'status' => 'success',
            'message' => __('messages.updateSuccess'),
        ]);
    }
}
