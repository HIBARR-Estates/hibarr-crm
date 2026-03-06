<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CRM Event Record Keeping Engine — Default Configuration
    |--------------------------------------------------------------------------
    |
    | This file defines the default event categories, event types, and business
    | rules that are seeded into the database. These are "system" definitions
    | (is_system = true) and will be upserted on every seed run.
    |
    | Admin-created types (is_system = false) are never overwritten by the seeder.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Event Categories
    |--------------------------------------------------------------------------
    |
    | Top-level groupings for event types.
    |
    */
    'categories' => [
        [
            'slug' => 'deal',
            'name' => 'Deal Events',
            'description' => 'Events related to deal lifecycle and activities.',
        ],
        [
            'slug' => 'lead',
            'name' => 'Lead Events',
            'description' => 'Events related to lead management and conversion.',
        ],
        [
            'slug' => 'property',
            'name' => 'Property Events',
            'description' => 'Events related to property listings and interactions.',
        ],
        [
            'slug' => 'task',
            'name' => 'Task Events',
            'description' => 'Events related to task management.',
        ],
        [
            'slug' => 'contact',
            'name' => 'Contact Events',
            'description' => 'Events related to contacts and client interactions.',
        ],
        [
            'slug' => 'communication',
            'name' => 'Communication Events',
            'description' => 'Events related to communication channels (email, WhatsApp, etc.).',
        ],
        [
            'slug' => 'system',
            'name' => 'System Events',
            'description' => 'System-level events (authentication, configuration, etc.).',
        ],
        [
            'slug' => 'external',
            'name' => 'External Events',
            'description' => 'Events originating from external sources (website visitors, webhooks, etc.).',
        ],
        [
            'slug' => 'user',
            'name' => 'User Events',
            'description' => 'Events related to user actions and profile changes.',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Event Types
    |--------------------------------------------------------------------------
    |
    | Specific event types within each category. The 'category' field references
    | the category slug. 'model_type' is the fully qualified model class when
    | applicable. 'sync_processing' controls sync (true) vs async (false).
    | 'business_rule' references a business rule slug when applicable.
    |
    */
    'event_types' => [

        // ── Deal Events ──────────────────────────────────────────
        [
            'slug' => 'deal_created',
            'name' => 'Deal Created',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'A new deal has been created.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_updated',
            'name' => 'Deal Updated',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'Deal details have been modified.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_stage_changed',
            'name' => 'Deal Stage Changed',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'Deal moved to a different pipeline stage.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_pipeline_changed',
            'name' => 'Deal Pipeline Changed',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'Deal moved to a different pipeline.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_agent_assigned',
            'name' => 'Deal Agent Assigned',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'An agent was assigned to a deal.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_note_added',
            'name' => 'Deal Note Added',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'A note was added to a deal.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_file_uploaded',
            'name' => 'Deal File Uploaded',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'A file was uploaded to a deal.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_property_linked',
            'name' => 'Deal Property Linked',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'A property was linked to a deal.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_closed_won',
            'name' => 'Deal Closed Won',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'Deal was closed as won.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'deal_closed_lost',
            'name' => 'Deal Closed Lost',
            'category' => 'deal',
            'model_type' => 'App\\Models\\Deal',
            'description' => 'Deal was closed as lost.',
            'sync_processing' => true,
        ],

        // ── Lead Events ──────────────────────────────────────────
        [
            'slug' => 'lead_created',
            'name' => 'Lead Created',
            'category' => 'lead',
            'model_type' => 'App\\Models\\Lead',
            'description' => 'A new lead was created.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'lead_updated',
            'name' => 'Lead Updated',
            'category' => 'lead',
            'model_type' => 'App\\Models\\Lead',
            'description' => 'Lead details were updated.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'lead_converted',
            'name' => 'Lead Converted',
            'category' => 'lead',
            'model_type' => 'App\\Models\\Lead',
            'description' => 'Lead was converted into a deal.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'lead_status_changed',
            'name' => 'Lead Status Changed',
            'category' => 'lead',
            'model_type' => 'App\\Models\\Lead',
            'description' => 'Lead status was changed.',
            'sync_processing' => true,
        ],

        // ── Property Events ──────────────────────────────────────
        [
            'slug' => 'property_created',
            'name' => 'Property Created',
            'category' => 'property',
            'model_type' => 'App\\Models\\Property',
            'description' => 'A new property listing was created.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'property_updated',
            'name' => 'Property Updated',
            'category' => 'property',
            'model_type' => 'App\\Models\\Property',
            'description' => 'Property details were updated.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'property_viewed',
            'name' => 'Property Viewed',
            'category' => 'property',
            'model_type' => 'App\\Models\\Property',
            'description' => 'A property was viewed (e.g. by a website visitor).',
            'sync_processing' => false,
            'business_rule' => 'site_visitor_property_view',
        ],
        [
            'slug' => 'property_enquiry_received',
            'name' => 'Property Enquiry Received',
            'category' => 'property',
            'model_type' => 'App\\Models\\Property',
            'description' => 'An enquiry was received for a property.',
            'sync_processing' => false,
            'business_rule' => 'site_visitor_property_enquiry',
        ],

        // ── Task Events ──────────────────────────────────────────
        [
            'slug' => 'task_created',
            'name' => 'Task Created',
            'category' => 'task',
            'model_type' => 'App\\Models\\Task',
            'description' => 'A new task was created.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'task_completed',
            'name' => 'Task Completed',
            'category' => 'task',
            'model_type' => 'App\\Models\\Task',
            'description' => 'A task was marked as completed.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'task_updated',
            'name' => 'Task Updated',
            'category' => 'task',
            'model_type' => 'App\\Models\\Task',
            'description' => 'Task details were updated.',
            'sync_processing' => true,
        ],

        // ── Contact Events ───────────────────────────────────────
        [
            'slug' => 'contact_created',
            'name' => 'Contact Created',
            'category' => 'contact',
            'model_type' => 'App\\Models\\LeadContact',
            'description' => 'A new contact was created.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'contact_updated',
            'name' => 'Contact Updated',
            'category' => 'contact',
            'model_type' => 'App\\Models\\LeadContact',
            'description' => 'Contact details were updated.',
            'sync_processing' => true,
        ],

        // ── Communication Events ─────────────────────────────────
        [
            'slug' => 'email_sent',
            'name' => 'Email Sent',
            'category' => 'communication',
            'description' => 'An email was sent from the CRM.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'email_received',
            'name' => 'Email Received',
            'category' => 'communication',
            'description' => 'An email was received and logged.',
            'sync_processing' => false,
        ],
        [
            'slug' => 'whatsapp_message_sent',
            'name' => 'WhatsApp Message Sent',
            'category' => 'communication',
            'description' => 'A WhatsApp message was sent.',
            'sync_processing' => false,
        ],
        [
            'slug' => 'whatsapp_message_received',
            'name' => 'WhatsApp Message Received',
            'category' => 'communication',
            'description' => 'A WhatsApp message was received.',
            'sync_processing' => false,
        ],

        // ── System Events ────────────────────────────────────────
        [
            'slug' => 'user_login',
            'name' => 'User Login',
            'category' => 'system',
            'description' => 'A user logged into the CRM.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'user_logout',
            'name' => 'User Logout',
            'category' => 'system',
            'description' => 'A user logged out of the CRM.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'settings_changed',
            'name' => 'Settings Changed',
            'category' => 'system',
            'description' => 'System settings were modified.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'data_import',
            'name' => 'Data Import',
            'category' => 'system',
            'description' => 'A data import operation was performed.',
            'sync_processing' => false,
        ],
        [
            'slug' => 'data_export',
            'name' => 'Data Export',
            'category' => 'system',
            'description' => 'A data export operation was performed.',
            'sync_processing' => false,
        ],

        // ── External Events ──────────────────────────────────────
        [
            'slug' => 'website_visit',
            'name' => 'Website Visit',
            'category' => 'external',
            'description' => 'A visitor accessed the website.',
            'sync_processing' => false,
            'business_rule' => 'site_visitor_tracking',
        ],
        [
            'slug' => 'form_submission',
            'name' => 'Form Submission',
            'category' => 'external',
            'description' => 'A form was submitted from an external source.',
            'sync_processing' => false,
            'business_rule' => 'external_form_submission',
        ],
        [
            'slug' => 'webhook_received',
            'name' => 'Webhook Received',
            'category' => 'external',
            'description' => 'A webhook payload was received from an external service.',
            'sync_processing' => false,
        ],

        // ── User Events ──────────────────────────────────────────
        [
            'slug' => 'user_created',
            'name' => 'User Created',
            'category' => 'user',
            'model_type' => 'App\\Models\\User',
            'description' => 'A new user account was created.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'user_updated',
            'name' => 'User Updated',
            'category' => 'user',
            'model_type' => 'App\\Models\\User',
            'description' => 'User profile was updated.',
            'sync_processing' => true,
        ],
        [
            'slug' => 'user_deactivated',
            'name' => 'User Deactivated',
            'category' => 'user',
            'model_type' => 'App\\Models\\User',
            'description' => 'A user account was deactivated.',
            'sync_processing' => true,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Business Rules
    |--------------------------------------------------------------------------
    |
    | Named business rules that event types can reference. External consumers
    | can send a business_rule_slug to tie an event to a specific business rule.
    | The rule_config JSON is extensible for future rule evaluation.
    |
    */
    'business_rules' => [
        [
            'slug' => 'site_visitor_property_view',
            'name' => 'Site Visitor Property View',
            'description' => 'Triggered when a website visitor views a property listing.',
            'rule_config' => [
                'source' => 'website',
                'action' => 'property_view',
            ],
        ],
        [
            'slug' => 'site_visitor_property_enquiry',
            'name' => 'Site Visitor Property Enquiry',
            'description' => 'Triggered when a website visitor submits a property enquiry.',
            'rule_config' => [
                'source' => 'website',
                'action' => 'property_enquiry',
            ],
        ],
        [
            'slug' => 'site_visitor_tracking',
            'name' => 'Site Visitor Tracking',
            'description' => 'General tracking of website visitor activity.',
            'rule_config' => [
                'source' => 'website',
                'action' => 'page_view',
            ],
        ],
        [
            'slug' => 'external_form_submission',
            'name' => 'External Form Submission',
            'description' => 'Processing of form submissions from external sources.',
            'rule_config' => [
                'source' => 'external',
                'action' => 'form_submit',
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Default Retention Policy
    |--------------------------------------------------------------------------
    |
    | Default retention settings applied when a company does not have a
    | specific retention policy configured.
    |
    */
    'retention' => [
        'max_age_days' => 365,
        'max_row_count' => 5000000,
        'archive_storage' => 'database',
        'archive_table' => 'crm_events_archive',
    ],

    /*
    |--------------------------------------------------------------------------
    | Cache Settings
    |--------------------------------------------------------------------------
    |
    | Cache TTL for event type lookups (in seconds).
    |
    */
    'cache' => [
        'event_type_ttl' => 300, // 5 minutes
        'prefix' => 'crm_event_',
    ],

    /*
    |--------------------------------------------------------------------------
    | Queue Settings
    |--------------------------------------------------------------------------
    |
    | Queue name and connection for async event processing.
    |
    */
    'queue' => [
        'connection' => null, // null = default connection
        // 'name' => 'crm_events',
        'name' => 'default', //made default queue name to crm_events to avoid changing supervisor config in production. Can be overridden in .env if needed.
    ],

];
