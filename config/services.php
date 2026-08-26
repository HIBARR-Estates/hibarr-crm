<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'authorize' => [
        'login' => env('AUTHORIZE_PAYMENT_API_LOGIN_ID'),
        'transaction' => env('AUTHORIZE_PAYMENT_TRANSACTION_KEY'),
        'sandbox' => env('AUTHORIZE_SANDBOX', true),
    ],

    'square' => [
        'application_id' => env('SQUARE_APPLICATION_ID'),
        'access_token' => env('SQUARE_ACCESS_TOKEN'),
        'location_id' => env('SQUARE_ACCESS_TOKEN'),
        'environment' => env('SQUARE_ENVIRONMENT', 'sandbox'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'telegram-bot-api' => [
        'token' => env('TELEGRAM_BOT_TOKEN', 'YOUR BOT TOKEN HERE')
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT'),
        'redirect_uri' => (env('APP_URL') . '/account/settings/google-auth'),
        // Let the user know what we will be using from his Google account.
        'scopes' => [
            // Getting access to the user's email.
            \Google_Service_Oauth2::USERINFO_EMAIL,
            \Google_Service_Oauth2::USERINFO_PROFILE,
            // Managing the user's calendars and events.
            \Google_Service_Calendar::CALENDAR,
        ],
        // Enables automatic token refresh.
        'approval_prompt' => 'force',
        'access_type' => 'offline',
        // Enables incremental scopes (useful if in the future we need access to another type of data).
        'include_granted_scopes' => true,
    ],

    'sentry' => [
        'enabled' => env('SENTRY_ENABLED', false)
    ],
    'onesignal' => [
        'app_id' => 'YOUR-APP-ID-HERE',
        'rest_api_key' => 'YOUR-REST-API-KEY-HERE',
    ],

    'meta' => [
        'pixel_id' => env('META_PIXEL_ID'),
        'access_token' => env('META_ACCESS_TOKEN'),
        'api_version' => env('META_CONVERSIONS_API_VERSION', 'v18.0'),
    ],

    'property_recommendation' => [
        'base_url' => env('PROPERTY_RECOMMENDATION_API_URL', 'https://pre.hibarr.org'),
        'timeout' => env('PROPERTY_RECOMMENDATION_API_TIMEOUT', 30),
        'cache_ttl' => env('PROPERTY_RECOMMENDATION_CACHE_TTL', 900), // 15 minutes
    ],

    'dynamic_translation' => [
        'base_url' => env('DYNAMIC_TRANSLATION_API_URL', env('AI_BASE_URL', '')),
        'timeout' => (int) env('DYNAMIC_TRANSLATION_API_TIMEOUT', env('AI_TIMEOUT', 30)),
        'api_key' => env('DYNAMIC_TRANSLATION_API_KEY', env('AI_API_KEY')),
    ],

    'notification_service' => [
        'base_url' => env('NOTIFICATION_SERVICE_BASE_URL', ''),
        'timeout' => (int) env('NOTIFICATION_SERVICE_TIMEOUT', 15),
        'internal_api_key' => env('NOTIFICATION_SERVICE_INTERNAL_API_KEY'),
        'default_user_id' => (int) env('NOTIFICATION_SERVICE_DEFAULT_USER_ID', 1),
    ],

    'keycloak' => [
        'client_id'     => env('KEYCLOAK_CLIENT_ID'),
        'client_secret' => env('KEYCLOAK_CLIENT_SECRET'),
        'redirect'      => env('KEYCLOAK_REDIRECT_URI'),
        'base_url'      => env('KEYCLOAK_BASE_URL'),
        'realms'        => env('KEYCLOAK_REALM'),
    ],

    'ai' => [
        'base_url' => env('AI_BASE_URL', ''),
        'timeout'  => (int) env('AI_TIMEOUT', 45),
        'provider' => env('AI_PROVIDER', 'openai'),
        'model'    => env('AI_MODEL', 'gpt-4o'),
        'api_key'  => env('AI_API_KEY'),
    ],

    'ol_webhook' => [
        'enabled' => (bool) env('OL_WEBHOOK_ENABLED', false),
        'endpoint' => env('OL_WEBHOOK_ENDPOINT'),
        'timeout' => (int) env('OL_WEBHOOK_TIMEOUT', 10),
        'api_key' => env('OL_WEBHOOK_API_KEY'),
        'api_key_header' => env('OL_WEBHOOK_API_KEY_HEADER', 'X-API-KEY'),
        'queue' => env('OL_WEBHOOK_QUEUE', 'ol_webhooks'),
        'tries' => (int) env('OL_WEBHOOK_TRIES', 3),
        'backoff' => array_map('intval', explode(',', (string) env('OL_WEBHOOK_BACKOFF', '60,300,900'))),
    ],

    /*
     * PostHog product analytics for the React/Inertia screens.
     *
     * Shipped to the browser through Inertia shared props rather than a build-time
     * env var, because two asset pipelines coexist here (Mix reads process.env.MIX_*,
     * Vite reads import.meta.env.VITE_*) and a build-time key would have to be
     * declared twice and rebuilt to rotate. The project key is a publishable
     * client-side key, so serving it in the page payload is its intended use.
     *
     * Leave POSTHOG_KEY empty to switch analytics off — that is the default, so
     * nothing is sent until someone deliberately configures it.
     */
    'posthog' => [
        'key' => env('POSTHOG_KEY'),
        'host' => env('POSTHOG_HOST', 'https://eu.i.posthog.com'),
    ],

    'ol' => [
        // Used for OL integration endpoints (e.g. Zoho Calendar sync jobs).
        // Default includes `/v1` to match frontend configuration.
        'base_url' => env('OL_BASE_URL', env('MIX_OL_BASE_URL', 'https://develop-api.hibarr.org/v1')),
        'api_key' => env('OL_API_KEY', env('MIX_OL_API_KEY')),
        'timeout' => (int) env('OL_API_TIMEOUT', 15),
        // Provisional HIB-1185 path; override via env when OL locks the contract.
        'payment_review_decision_path' => env(
            'OL_PAYMENT_REVIEW_DECISION_PATH',
            '/internal/payments/review-decision'
        ),
        'crm_webhook_api_key' => env('CRM_WEBHOOK_API_KEY'),
        'deal_payment_request_path' => env(
            'OL_DEAL_PAYMENT_REQUEST_PATH',
            '/internal/payments/deal-requests'
        ),
    ],
];
