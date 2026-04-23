<?php

/**
 * pages.php — Turkish (tr) overrides for frontend page-level UI strings.
 * Only keys that differ from eng/pages.php need to be listed here.
 * Missing keys fall back to English automatically via array_replace_recursive()
 * in HandleInertiaRequests::getTranslations().
 */

return [

    'dashboard' => [
        'stats' => [
            'total_tasks'       => 'Toplam Görevler',
            'overdue_tasks'     => 'Gecikmiş Görevler',
            'total_deals'       => 'Toplam Anlaşmalar',
            'weekly_activities' => 'Haftalık Aktiviteler',
        ],
    ],

    'leads' => [
        'contacts'                 => 'Kişiler',
        'refresh_tooltip_disabled' => 'Yenilemeden önce değişiklikleri kaydedin veya iptal edin',
        'save_before_tab_switch'   => 'Sekme değiştirmeden önce lütfen değişikliklerinizi kaydedin veya iptal edin.',
        'tabs' => [
            'profile'   => 'Profil',
            'notes'     => 'Notlar',
            'marketing' => 'Pazarlama',
            'tasks'     => 'Görevler',
            'events'    => 'Etkinlikler',
        ],
    ],

];
