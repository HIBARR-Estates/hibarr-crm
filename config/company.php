<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default Email Domain for Name-to-Email Conversion
    |--------------------------------------------------------------------------
    |
    | This domain is appended when converting responsible person names into
    | email addresses during deal imports (e.g. "john.d@hibarr.de").
    |
    */

    'email_domain' => env('COMPANY_EMAIL_DOMAIN', 'hibarr.de'),

    /*
    |--------------------------------------------------------------------------
    | Special-case Name to Username Mapping
    |--------------------------------------------------------------------------
    |
    | Provide overrides for specific names. The keys should be the full name
    | (case-insensitive) and the value the username portion that precedes the
    | @domain.
    |
    */

    'email_special_cases' => [
        'rabih rabea' => 'r.r',
        'shirin' => 'shirin',
    ],
];

