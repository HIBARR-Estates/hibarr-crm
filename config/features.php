<?php

return [
    'app_name' => 'crm',
    'cache_ttl' => (int) env('FEATURE_FLAGS_CACHE_TTL', 60),
    'known_flags' => [
        'crm.lead-qualification-tab',
        'crm.lead-language-core-field',
        'crm.deal-view-redesign',
        'crm.lead-view-redesign',
        'crm.lead-ai-summary',
        'crm.notification-service-routing',
        'sales.ai-entity-summary',
        'sales.per-agent-commission-override',
        'sales.bulk-agent-promotion',
        'sales.crm-lead-deal-sync',
    ],
];
