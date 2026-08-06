<?php

return [
    /*
    |--------------------------------------------------------------------------
    | API token endpoint scopes
    |--------------------------------------------------------------------------
    |
    | Scope keys match Laravel route names. Tokens with null/empty scopes have
    | full access (backward compatible). Restricted tokens must include the
    | route name for each endpoint they call.
    |
    */
    'groups' => [
        'crm_write' => [
            'label' => 'CRM Write (API v2)',
            'scopes' => [
                'api.v2.tasks.index' => 'List tasks',
                'api.v2.tasks.create' => 'Create tasks',
                'api.v2.tasks.show' => 'Read task',
                'api.v2.tasks.update' => 'Update task',
                'api.v2.tasks.destroy' => 'Delete task',
                'api.v2.notes.index' => 'List notes',
                'api.v2.notes.create' => 'Create notes',
                'api.v2.notes.show' => 'Read note',
                'api.v2.notes.update' => 'Update note',
                'api.v2.notes.destroy' => 'Delete note',
                'api.v2.meetings.index' => 'List meetings',
                'api.v2.meetings.create' => 'Create meetings',
                'api.v2.meetings.show' => 'Read meeting',
                'api.v2.meetings.update' => 'Update meeting',
                'api.v2.meetings.destroy' => 'Delete meeting',
            ],
        ],
        'employees' => [
            'label' => 'Employees (API v2)',
            'scopes' => [
                'api.v2.employees.create.compat' => 'Create employee',
                'api.v2.employees.findOrCreate.compat' => 'Find or create employee',
                'api.v2.employees.list.compat' => 'List employees',
                'api.v2.employees.departments.compat' => 'List departments',
                'api.v2.employees.designations.compat' => 'List designations',
                'api.v2.employees.get.compat' => 'Read employee',
                'api.v2.employees.update.compat' => 'Update employee',
            ],
        ],
        'leads_deals' => [
            'label' => 'Leads & Deals',
            'scopes' => [
                'api.leads.index' => 'List leads',
                'api.deals.create' => 'Create deal',
                'api.contacts.createOrUpdate' => 'Create or update contact',
            ],
        ],
        'communication' => [
            'label' => 'Communication',
            'scopes' => [
                'api.communication-activities.store' => 'Create communication activity',
                'api.deals.communication-activities' => 'List deal communication activities',
                'api.leads.communication-activities' => 'List lead communication activities',
                'api.communication-activities.by-channel' => 'List activities by channel',
                'api.communication-activities.send-email' => 'Send communication email',
                'api.meeting-summary' => 'Meeting summary (legacy POST)',
                'api.meeting-summary.show' => 'Read meeting summary',
                'api.meeting-summary.store' => 'Create meeting summary',
            ],
        ],
        'tasks' => [
            'label' => 'Tasks (read-only)',
            'scopes' => [
                'api.tasks.today' => 'List tasks due today',
            ],
        ],
        'properties' => [
            'label' => 'Properties',
            'scopes' => [
                'api.properties.index' => 'List properties',
                'api.properties.show' => 'Read property',
                'api.properties.expose' => 'Read property expose presentation data',
                'api.properties.filters.property_types' => 'Property type filters',
                'api.properties.filters.features' => 'Property feature filters',
                'api.properties.filters.location' => 'Property location filters',
            ],
        ],
        'developer_projects' => [
            'label' => 'Developer Projects',
            'scopes' => [
                'api.developer-projects.index' => 'List developer projects',
                'api.developer-projects.show' => 'Read developer project',
                'api.developer-projects.expose' => 'Read developer project expose presentation data',
                'api.developer-projects.unit-types.expose' => 'Read unit type expose presentation data',
            ],
        ],
        'external_events' => [
            'label' => 'External Events',
            'scopes' => [
                'api.external-events.store' => 'Create external event',
                'api.external-events.index' => 'List external events',
                'api.external-events.show' => 'Read external event',
            ],
        ],
        'bitrix' => [
            'label' => 'Bitrix Import',
            'scopes' => [
                'api.bitrix.import' => 'Import deals',
                'api.bitrix.contact.import' => 'Import contacts',
                'api.bitrix.comments.import' => 'Import comments',
                'api.bitrix.tasks.import' => 'Import tasks',
            ],
        ],
        'internal' => [
            'label' => 'Internal / MLM',
            'scopes' => [
                'api.internal.agents.commission-profile.show' => 'Read agent commission profile',
                'api.internal.agents.commission-profile.update' => 'Update agent commission profile',
                'api.internal.commissions.levels.index' => 'List commission levels',
                'api.internal.agents.level.update' => 'Update agent level',
            ],
        ],
    ],
];
