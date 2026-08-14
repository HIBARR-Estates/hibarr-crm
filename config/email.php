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

    'plunk_template_ids' => [
        'lead_follow_up_overdue' => env('LEAD_FOLLOW_UP_OVERDUE_PLUNK_TEMPLATE_ID', ''),
    ],

];
