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

        // Property workflow
        'property_request' => '4b95a65c-9c0e-419a-b4c2-699370eaa829',
        'property_request_reviewed' => '381c73fb-3938-4b32-8255-d3fb9d68d501', // same layout as entity-activity
        'expose_ready' => '588657fa-4242-4b4b-b8b9-6279b93cd97e',

        'lead_follow_up_overdue' => env('LEAD_FOLLOW_UP_OVERDUE_PLUNK_TEMPLATE_ID', ''),
    ],

];
