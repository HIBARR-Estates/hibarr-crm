<?php

/**
 * pages.php — Frontend page-level UI strings (React / Inertia)
 *
 * Convention:
 *   pages.<folder>.<key>
 *
 * e.g.  pages.deals.add_deal     → "Add Deal"
 *       pages.clients.title      → "Clients"
 *
 * Keys here are consumed by the t() helper in React components via
 * the useTranslation() hook.  Do NOT put backend / Laravel strings here.
 *
 * Matching locale files: de/pages.php  ru/pages.php  tr/pages.php
 */

return [

    'dashboard' => [
        'stats' => [
            'total_tasks'       => 'Total Tasks',
            'overdue_tasks'     => 'Overdue Tasks',
            'total_deals'       => 'Total Deals',
            'weekly_activities' => 'Weekly Activities',
        ],
    ],

    'leads' => [
        'contacts'                 => 'Contacts',
        'refresh_tooltip_disabled' => 'Save or cancel changes before refreshing',
        'save_before_tab_switch'   => 'Please save or cancel your changes before switching tabs.',
        'tabs' => [
            'profile'   => 'Profile',
            'notes'     => 'Notes',
            'marketing' => 'Marketing',
            'tasks'     => 'Tasks',
            'events'    => 'Events',
        ],
    ],

];
