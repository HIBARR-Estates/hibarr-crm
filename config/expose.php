<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Shareable exposé base URL
    |--------------------------------------------------------------------------
    |
    | CRM mints snapshot tokens and builds share links as:
    | {share_base_url}/{token}
    |
    | The hosting app (e.g. hibarr-os-expose) resolves the token via OL → CRM.
    |
    */
    'share_base_url' => rtrim(
        (string) env('EXPOSE_SHARE_BASE_URL', 'https://hibarr-os-expose.vercel.app'),
        '/'
    ),
];
