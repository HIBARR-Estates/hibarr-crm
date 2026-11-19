# Realtime notifications — operations

Notification popups and the bell are pushed over a WebSocket (self-hosted
[Laravel Reverb](https://reverb.laravel.com), Pusher protocol) instead of being polled every 30 s.
Design and decisions: `.claude/briefs/realtime-notifications.md`.

The feature is **inert until provisioned**: with nothing below configured the browser keeps polling exactly
as before, and a deploy changes nothing.

## How the pieces fit

```
->notify() / scheduler            queue worker (or request)
   │ database channel writes the row
   ▼
NotificationSent ──► BroadcastDatabaseNotification ──► UserNotificationCreated
                                                         │ HTTP (Pusher API, 1 s / 2 s timeouts)
                                                         ▼
browser ◄── wss://<host>/app/<key> ◄── nginx ◄── reverb:start (127.0.0.1:8080)
   │ on every (re)connect: GET /account/api/notifications/since?cursor=…  (gap-fill from the database)
```

The database row is the source of truth. The socket only delivers it; anything it misses (reconnects,
deploy restarts, outages) is recovered from the database by the browser.

## Enabling it

1. **Secrets** (Infisical, per environment). Generate once per environment; never reuse the legacy Pusher
   credentials and never put the secret in anything the browser receives.

   | Variable | Value |
   | --- | --- |
   | `REVERB_APP_ID` | any unique id, e.g. `hibarr-crm-prod` |
   | `REVERB_APP_KEY` | random, e.g. `openssl rand -hex 16` (public: shipped to the browser) |
   | `REVERB_APP_SECRET` | random, e.g. `openssl rand -hex 32` (server only) |
   | `REVERB_HOST` | public hostname browsers connect to (the CRM host) |
   | `REVERB_PORT` | `443` |
   | `REVERB_SCHEME` | `https` |
   | `REVERB_ALLOWED_ORIGINS` | CRM hostname(s), comma separated, e.g. `crm.example.com` (hosts, not URLs; defaults to the host of `APP_URL`) |
   | `NOTIFICATIONS_REALTIME_ENABLED` | `true` (the server-side kill switch) |

   The publishing side (`config/broadcasting.php` → `reverb`) talks to `REVERB_HOST:REVERB_PORT` over the
   same public address, so no separate internal address is needed.

2. **nginx** on the host (not in this repo). Add inside the CRM `server { … }` block:

   ```nginx
   # WebSocket endpoint
   location /app {
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_read_timeout 120s;   # Reverb pings every 60 s; must be longer than that
       proxy_send_timeout 120s;
       proxy_pass http://127.0.0.1:8080;
   }

   # Pusher HTTP API used by the app to publish events (only the app itself calls this)
   location /apps {
       proxy_set_header Host $host;
       proxy_pass http://127.0.0.1:8080;
   }
   ```

   Reload nginx, then deploy. `scripts/fix_for_supervisor_reverb.sh` (called from the Jenkinsfile) detects
   `REVERB_APP_KEY` in the host `.env`, writes the supervisor program `hibarr_crm_reverb`
   (`hibarr_crm_staging_reverb` on staging) and restarts it on every deploy.

3. **Open-file limit.** Every browser tab is one socket and supervisor's default is 1024 descriptors.
   Set `minfds=10000` in the `[supervisord]` section of `/etc/supervisor/supervisord.conf` and restart
   supervisord once.

4. **Feature flag.** Turn on `crm.realtime-notifications` in the feature-flag service. It also needs
   `crm.notification-island-alerts` (the popup surface). The flag is global, not per user, so rollout is
   all-or-nothing: try it on staging first.

## Verifying

- `sudo supervisorctl status hibarr_crm_reverb` → `RUNNING`; log at `/home/hibarr/shared/hibarr_crm_reverb.log`.
- Browser devtools → Network → WS: one connection to `/app/<key>`, state `101`, and a frame
  `pusher_internal:subscription_succeeded` for `private-notifications.<userId>`.
- Create any notification for yourself: the popup appears within about a second, with no
  `unread-summary` polling in the Network tab (only one initial request and `since` on connect).

## Rolling back

| Want | Do | Effect |
| --- | --- | --- |
| Back to polling for everyone, instantly | turn off `crm.realtime-notifications` | the next page load / Inertia visit polls again |
| Stop publishing, keep the server | `NOTIFICATIONS_REALTIME_ENABLED=false` | nothing is broadcast; browsers fall back to the slow catch-up timer |
| Remove the server | delete `REVERB_APP_KEY` and deploy | the script removes the supervisor program |

None of these lose a notification: the rows are in the database and the browser's catch-up reads them.

## Failure behaviour (what users see)

- **Reverb down / restarting (including every deploy):** open tabs reconnect on their own. After 20 s without a
  connection a tab asks `since` once a minute; on reconnect it asks once and shows what it missed
  (more than 3 missed at once collapse into one "N new notifications" card).
- **Broadcast fails on the server:** logged (`report()`), never rethrown. The notification row, its email and
  its other channels are unaffected, and the browser picks it up from the database.
- **Message too large for the socket (> 8 KB):** only the id is pushed and the browser fetches the content.

## Operational limits

- **Single instance.** Scaling Reverb horizontally needs Redis pub/sub, which this stack does not run.
  One process comfortably serves thousands of idle sockets; watch the descriptor limit above.
- **Several tabs per user** each hold a socket. One tab per user plays the sound / OS popup (Web Locks
  election); every tab updates its own view.
- **Secret rotation:** change `REVERB_APP_SECRET` (and the key if wanted), deploy; browsers reconnect with the
  new `key` from the next page load, and the old one stops working at once.
- **Legacy chat / taskboard** still use hosted Pusher from the `pusher_settings` row and are untouched.
