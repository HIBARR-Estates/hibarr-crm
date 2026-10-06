<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Email Template Logo URLs
    |--------------------------------------------------------------------------
    |
    | These URLs are used in email templates for the company logo.
    | You can update these URLs to change the logos used in all email templates.
    |
    | Light Logo: Used in light mode email clients
    | Dark Logo: Used in dark mode email clients
    |
    */

    'logo' => [
        'light' => env('EMAIL_LOGO_LIGHT', 'https://res.cloudinary.com/hibarr/image/upload/v1747030452/hibarr-logo-blue_be6oer.png'),
        'dark' => env('EMAIL_LOGO_DARK', 'https://res.cloudinary.com/hibarr/image/upload/v1752237736/logo_ywr5n3.png'),
    ],

    /*
    | Plunk template IDs — paste HTML from resources/views/mail/plunk/*.plunk.html
    | into Plunk, then set the returned template ID here (no .env required for property).
    */
    'plunk_template_ids' => [
        // Shared: deal / lead / property lifecycle / task activity
        'entity_activity' => '381c73fb-3938-4b32-8255-d3fb9d68d501',

        // Task lifecycle (created, updated, due, completed)
        'task_lifecycle' => '44b4e878-07ff-4ffa-9192-0ccd823987b9',

        // Property workflow
        'property_request' => '4b95a65c-9c0e-419a-b4c2-699370eaa829',
        'property_request_reviewed' => '381c73fb-3938-4b32-8255-d3fb9d68d501', // same layout as entity-activity
        'expose_ready' => '588657fa-4242-4b4b-b8b9-6279b93cd97e',

        'deal_close_date_approaching' => 'f1da65e3-4b42-40c5-b5ae-1ba82fe3d94d',
        'deal_deleted' => '45171f58-24cf-468e-8a8b-0edaf9023142',

        'lead_follow_up_overdue' => env('LEAD_FOLLOW_UP_OVERDUE_PLUNK_TEMPLATE_ID', ''),
    ],

    /*
    |--------------------------------------------------------------------------
    | CRM Email module (App\Email)
    |--------------------------------------------------------------------------
    |
    | Mailbox integration behind the crm.email feature flag — unrelated to the
    | notification template settings above. See docs/email/architecture.md.
    |
    | Dedicated queues keep mail sync/send off the default workers. The provider
    | selects the MailTransport adapter for new connections: fake | mailtrap | zoho.
    |
    */

    'flag' => 'crm.email',

    'queues' => [
        'sync' => env('EMAIL_SYNC_QUEUE', 'email-sync'),
        'send' => env('EMAIL_SEND_QUEUE', 'email-send'),
    ],

    'default_provider' => env('EMAIL_DEFAULT_PROVIDER', 'fake'),

    /*
    |--------------------------------------------------------------------------
    | Email files (attachments)
    |--------------------------------------------------------------------------
    |
    | Stored through the existing file gateway (config/file_storage.php) under
    | their own prefix — never as lead or deal files. Size and type limits are
    | placeholders until the security policy is signed.
    |
    | No malware scanner exists yet (E-43), so every stored file stays
    | "pending". Unscanned files can be neither downloaded nor sent unless
    | allow_unscanned is switched on, which is meant for dev/staging sandboxes
    | only and is ignored in production.
    |
    */

    'files' => [
        'prefix' => 'email-attachments',
        'max_bytes' => (int) env('EMAIL_FILES_MAX_BYTES', 25 * 1024 * 1024),
        'blocked_extensions' => ['exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'msi', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'ps1', 'jar', 'lnk', 'hta'],
        'allow_unscanned' => (bool) env('EMAIL_FILES_ALLOW_UNSCANNED', false),
        'timeout' => (int) env('EMAIL_FILES_TIMEOUT', 30),
    ],

    /*
    |--------------------------------------------------------------------------
    | Mailtrap Email Sandbox (dev / staging adapter)
    |--------------------------------------------------------------------------
    |
    | Sandbox only — mail is captured by Mailtrap and never reaches a real
    | recipient. This is not Mailtrap's live Sending product, and the adapter
    | is never selectable in production whatever "environments" says.
    |
    | Account-level settings live here (the API token belongs in Infisical /
    | env). Everything specific to one mailbox is stored encrypted on its
    | email_connections row, as credentials:
    |
    |   inbox_id       the sandbox inbox this connection reads and sends through
    |   smtp_username  that inbox's SMTP user
    |   smtp_password  that inbox's SMTP password
    |
    | Two agents, two sandboxes. One Mailtrap inbox stands in for one agent's
    | mailbox, so a two-agent scenario needs two inboxes and two connections:
    |
    |   Agent A's connection -> sandbox "a" (MAILTRAP_INBOX_ID_A)
    |   Agent B's connection -> sandbox "b" (MAILTRAP_INBOX_ID_B)
    |
    | For local setup a connection may store credentials.sandbox = "a" or "b"
    | instead of inbox_id and the id is read from "sandboxes" below. Staging
    | stores the real inbox_id on the connection.
    |
    | A message sent into sandbox A does not appear in sandbox B. To simulate
    | one email received by both agents, inject the same RFC Message-ID into
    | both inboxes. Plus-addressing is not a substitute for a second inbox.
    |
    */

    'mailtrap' => [
        'api_token' => env('MAILTRAP_API_TOKEN'),
        'account_id' => env('MAILTRAP_ACCOUNT_ID'),
        'api_base_url' => env('MAILTRAP_API_BASE_URL', 'https://mailtrap.io'),
        'timeout' => (int) env('MAILTRAP_TIMEOUT', 10),

        'smtp' => [
            'host' => env('MAILTRAP_SMTP_HOST', 'sandbox.smtp.mailtrap.io'),
            'port' => (int) env('MAILTRAP_SMTP_PORT', 2525),
        ],

        'sandboxes' => [
            'a' => env('MAILTRAP_INBOX_ID_A'),
            'b' => env('MAILTRAP_INBOX_ID_B'),
        ],

        'environments' => ['local', 'development', 'staging', 'testing'],
    ],

];
