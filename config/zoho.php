<?php

return [
    'client_id' => env('ZOHO_CLIENT_ID'),
    'client_secret' => env('ZOHO_CLIENT_SECRET'),
    'redirect_uri' => env('ZOHO_REDIRECT_URI'),
    'refresh_token' => env('ZOHO_REFRESH_TOKEN'),
    'access_token' => env('ZOHO_ACCESS_TOKEN'),
    'api_base_url' => env('ZOHO_API_BASE_URL', 'https://www.zohoapis.com'),
    'authorize_url' => 'https://accounts.zoho.com/oauth/v2/auth',
    'token_url'     => 'https://accounts.zoho.com/oauth/v2/token',
    'userinfo_url'  => 'https://accounts.zoho.com/oauth/user/info',
];
