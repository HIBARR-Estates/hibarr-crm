<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Meeting attendance confirmation
    |--------------------------------------------------------------------------
    |
    | Sole kill switch: FeatureFlags::enabled('crm.meeting-attendance-confirmation')
    | (OFF until enabled in the feature-flag service). No per-company opt-in
    | on top of this — once the flag is on, it's on for every company.
    |
    | Delay/snooze below are the defaults used when a company hasn't set its
    | own override in Company Settings
    | (companies.meeting_attendance_confirmation_{delay,snooze}_minutes).
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Confirmation delay (default)
    |--------------------------------------------------------------------------
    |
    | Minutes after a meeting's computed end time (next_follow_up_date +
    | duration) before the attendance-confirmation prompt becomes eligible.
    |
    */
    'attendance_confirmation_delay_minutes' => (int) env('MEETING_ATTENDANCE_CONFIRMATION_DELAY_MINUTES', 5),

    /*
    |--------------------------------------------------------------------------
    | Snooze duration (default)
    |--------------------------------------------------------------------------
    |
    | Minutes a "Snooze" on the reminders dock hides a meeting for before it
    | becomes eligible to prompt again.
    |
    */
    'attendance_confirmation_snooze_minutes' => (function () {
        $value = filter_var(env('MEETING_ATTENDANCE_CONFIRMATION_SNOOZE_MINUTES'), FILTER_VALIDATE_INT);

        return $value !== false && $value > 0 ? $value : 60;
    })(),

];
