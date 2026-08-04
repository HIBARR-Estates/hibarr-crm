<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default reminder offsets
    |--------------------------------------------------------------------------
    |
    | Fallback when no per-record cadence and no EntityReminderDefault row.
    | Stored as {time, type} for compatibility with DealFollowUp / user prefs;
    | ReminderCreator converts to minutes-before when expanding.
    |
    */
    'default' => [
        ['time' => 1, 'type' => 'hour'],
        ['time' => 30, 'type' => 'minute'],
        ['time' => 15, 'type' => 'minute'],
        ['time' => 5, 'type' => 'minute'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Configurable entity types for company reminder defaults
    |--------------------------------------------------------------------------
    |
    | Keys are stored on entity_reminder_defaults.entity_type.
    | "all" is the catch-all fallback when a specific type has no active row.
    |
    */
    'entity_types' => [
        'all',
        'meeting',
        'task',
        'deal',
        'lead',
    ],

    /*
    |--------------------------------------------------------------------------
    | Entity reminders — staged company allowlist
    |--------------------------------------------------------------------------
    |
    | Global kill switch: FeatureFlags::enabled('crm.entity-reminders')
    | (OFF until enabled in the feature-flag service).
    |
    | When ON, only company IDs listed here use ReminderCreator + workers.
    | Everyone else keeps the legacy SendAutoFollowUpReminder path.
    |
    | Empty = no companies. Use * for all companies once verified.
    | ENTITY_REMINDERS_COMPANY_ALLOWLIST=123 or 123,456 or *
    |
    */
    'entity_reminders_company_allowlist' => trim((string) env('ENTITY_REMINDERS_COMPANY_ALLOWLIST', '')),

];
