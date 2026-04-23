<?php

/**
 * pages.php — German (de) overrides for frontend page-level UI strings.
 * Only keys that differ from eng/pages.php need to be listed here.
 * Missing keys fall back to English automatically via array_replace_recursive()
 * in HandleInertiaRequests::getTranslations().
 */

return [

    'dashboard' => [
        'stats' => [
            'total_tasks'       => 'Aufgaben gesamt',
            'overdue_tasks'     => 'Überfällige Aufgaben',
            'total_deals'       => 'Deals gesamt',
            'weekly_activities' => 'Wöchentliche Aktivitäten',
        ],
    ],

    'leads' => [
        'contacts'                 => 'Kontakte',
        'refresh_tooltip_disabled' => 'Bitte Änderungen speichern oder abbrechen, bevor Sie aktualisieren',
        'save_before_tab_switch'   => 'Bitte speichern oder brechen Sie Ihre Änderungen ab, bevor Sie den Tab wechseln.',
        'tabs' => [
            'profile'   => 'Profil',
            'notes'     => 'Notizen',
            'marketing' => 'Marketing',
            'tasks'     => 'Aufgaben',
            'events'    => 'Ereignisse',
        ],
    ],

];
