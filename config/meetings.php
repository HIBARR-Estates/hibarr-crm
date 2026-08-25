<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Meeting attendance confirmation — staged company allowlist
    |--------------------------------------------------------------------------
    |
    | Global kill switch: FeatureFlags::enabled('crm.meeting-attendance-confirmation')
    | (OFF until enabled in the feature-flag service).
    |
    | When ON, only company IDs listed here prompt agents to confirm meeting
    | outcomes. Everyone else sees no change.
    |
    | Empty = no companies. Use * for all companies once verified.
    | MEETING_ATTENDANCE_CONFIRMATION_COMPANY_ALLOWLIST=123 or 123,456 or *
    |
    */
    'attendance_confirmation_company_allowlist' => trim((string) env('MEETING_ATTENDANCE_CONFIRMATION_COMPANY_ALLOWLIST', '')),

    /*
    |--------------------------------------------------------------------------
    | Bypass remote feature flag
    |--------------------------------------------------------------------------
    |
    | When true, MeetingAttendanceConfirmationFeature ignores
    | FeatureFlags::enabled('crm.meeting-attendance-confirmation') and still
    | respects the company allowlist. Use locally when the flags API is
    | unreachable, or as an ops override.
    |
    */
    'attendance_confirmation_force_enable' => filter_var(env('MEETING_ATTENDANCE_CONFIRMATION_FORCE_ENABLE', false), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Confirmation delay
    |--------------------------------------------------------------------------
    |
    | Minutes after a meeting's computed end time (next_follow_up_date +
    | duration) before the attendance-confirmation prompt becomes eligible.
    |
    */
    'attendance_confirmation_delay_minutes' => (int) env('MEETING_ATTENDANCE_CONFIRMATION_DELAY_MINUTES', 5),

];
