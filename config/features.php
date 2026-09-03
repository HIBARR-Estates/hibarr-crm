<?php

return [
    'app_name' => 'crm',
    'cache_ttl' => (int) env('FEATURE_FLAGS_CACHE_TTL', 10),
    'known_flags' => [
        'crm.lead-qualification-tab',
        'crm.deal-view-redesign',
        'crm.lead-view-redesign',
        'crm.lead-ai-summary',
        'crm.lead-merge',
        'crm.lead-automation-engine',
        'crm.notification-service-routing',
        'crm.notification-island-alerts',
        'crm.entity-reminders',
        'crm.task-lifecycle-notifications',
        'crm.projects-filters-modal',
        'crm.projects-filters-v2',
        'crm.developer-project-visibility',
        'crm.pipeline-nav-visibility',
        'sales.ai-entity-summary',
        'sales.per-agent-commission-override',
        'sales.bulk-agent-promotion',
        'sales.crm-lead-deal-sync',
        'sally.crm-write-client',
        'integrations.zoho-calendar-sync',
        'crm.unit-sold-out-badge',
        'crm.unit-sold-out-grid-diagonal-ribbon',
        'crm.leads-product-tour',
        'crm.list-product-tours',
        'crm.deal-info-count-indicator',
        'crm.flight-itinerary-extraction',
        'crm.deal-analysis',
        'crm.leads-filter-v2',
        'crm.expose-share-links',
        'crm.deal-exposes-tab',
        'crm.tasks-workspace-redesign',
        'crm.automation-v2',
        'crm.custom-fields-cross-model-optimizations',
        'crm.meeting-attendance-confirmation',
        'crm.meeting-host',
        'crm.notification-bypass',
        'crm.user-timezone',
        'packages.online-payment',
        'crm.deal-files-grouping',
    ],

    /*
    | Local-only fallback when the remote flags API can't be reached (e.g. no
    | network access from a Herd/local dev box). Only ever applied in
    | local/development/codecanyon environments AND only when the API call
    | itself failed — staging and production always defer to the real remote
    | service, even on an outage, so a flag being "on" here never leaks into
    | a real environment. Flags not listed still default to off, same as before.
    */
    'local_defaults' => [
        'crm.meeting-attendance-confirmation' => true,
        'crm.deal-files-grouping' => true,
    ],

    /*
    | Local-only override applied on top of the real remote response too —
    | not just when it's unreachable (that's local_defaults, above). For a
    | flag you're actively building that isn't registered on the remote
    | flags service yet, so a live, reachable remote call doesn't silently
    | resolve it to false forever. Only ever applied in
    | local/development/codecanyon environments — staging and production
    | always defer entirely to the real remote service.
    */
    'local_overrides' => [
        'crm.deal-files-grouping' => true,
    ],
];
