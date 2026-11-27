<?php

/*
|--------------------------------------------------------------------------
| Realtime notifications
|--------------------------------------------------------------------------
|
| Pushes a notification to the recipient's open browser tabs the moment its
| `notifications` row is created, instead of the browser polling for it.
| The database row stays the source of truth; the socket only delivers it.
|
| Server side this is controlled by `enabled` (env kill switch) plus a complete
| `reverb` broadcast connection. The browser side is controlled by the
| `crm.realtime-notifications` feature flag.
|
*/

return [

    'notifications' => [

        // Env kill switch. Off (the default) means nothing is ever broadcast.
        'enabled' => (bool) env('NOTIFICATIONS_REALTIME_ENABLED', false),

        // Broadcast connection (config/broadcasting.php) the events are pinned to.
        'connection' => env('NOTIFICATIONS_REALTIME_CONNECTION', 'reverb'),

        // Reverb rejects messages over 10 000 bytes (REVERB_APP_MAX_MESSAGE_SIZE), and a
        // rejected message is a lost popup. Above this the event carries only
        // the id and the browser fetches the content through the catch-up endpoint.
        'max_payload_bytes' => 8000,

        // Catch-up endpoint (GET api/notifications/since).
        'catch_up_limit' => 50,

        // created_at only has second precision and ids are random UUIDs, so a plain
        // "newer than the cursor" would skip a row written in the same second as the
        // last one seen. The endpoint re-reads this many seconds before the cursor and
        // the browser applies items idempotently by id.
        'catch_up_overlap_seconds' => 5,
    ],

    // Handed to the browser as the `realtime` Inertia prop. Public values only:
    // never put REVERB_APP_SECRET (or the app id) here.
    'client' => [
        'key' => env('REVERB_APP_KEY'),
        'host' => env('REVERB_HOST'),
        'port' => (int) env('REVERB_PORT', 443),
        'scheme' => env('REVERB_SCHEME', 'https'),
    ],

];
