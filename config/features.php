<?php

return [
    'crm' => [
        'lead-qualification-tab' => env('FEATURE_CRM_LEAD_QUALIFICATION_TAB', false),
        'lead-language-core-field' => env('FEATURE_CRM_LEAD_LANGUAGE_CORE_FIELD', true),
    ],
    'sales' => [
        'per-agent-commission-override' => env('FEATURE_SALES_PER_AGENT_COMMISSION_OVERRIDE', false),
        'bulk-agent-promotion' => env('FEATURE_SALES_BULK_AGENT_PROMOTION', false),
    ],
];
