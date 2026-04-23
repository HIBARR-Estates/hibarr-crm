<?php

/**
 * pages.php — Russian (ru) overrides for frontend page-level UI strings.
 * Only keys that differ from eng/pages.php need to be listed here.
 * Missing keys fall back to English automatically via array_replace_recursive()
 * in HandleInertiaRequests::getTranslations().
 */

return [

    'dashboard' => [
        'stats' => [
            'total_tasks'       => 'Всего задач',
            'overdue_tasks'     => 'Просроченные задачи',
            'total_deals'       => 'Всего сделок',
            'weekly_activities' => 'Активности за неделю',
        ],
    ],

    'leads' => [
        'contacts'                 => 'Контакты',
        'refresh_tooltip_disabled' => 'Сохраните или отмените изменения перед обновлением',
        'save_before_tab_switch'   => 'Пожалуйста, сохраните или отмените изменения перед переключением вкладки.',
        'tabs' => [
            'profile'   => 'Профиль',
            'notes'     => 'Заметки',
            'marketing' => 'Маркетинг',
            'tasks'     => 'Задачи',
            'events'    => 'События',
        ],
    ],

];
