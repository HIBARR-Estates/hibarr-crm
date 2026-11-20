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
                                                         │ REVERB_PUBLISH_* (internal address)
                                                         ▼
browser ◄──── wss://ws.<domain>/app/<key> ◄──── Traefik ◄──── reverb container (:8080)
   │ on every (re)connect: GET /account/api/notifications/since?cursor=…  (gap-fill from the database)
```

The database row is the source of truth. The socket only delivers it; anything it misses (reconnects,
deploys, outages) is recovered from the database by the browser.

## Deploying on Coolify (Traefik)

Reverb is its own container, **on its own subdomain**, routed by Traefik straight to it. That keeps the WebSocket
away from the app container's nginx and from the `coolify-nginx-reverse-proxy` hop in front of it: Traefik
passes WebSocket upgrades through natively, so there is no proxy config to write.

1. **Create a Coolify resource for Reverb** from the same repository / Dockerfile (or the same image) as the app:

   | Setting | Value |
   | --- | --- |
   | Environment `CONTAINER_ROLE` | `reverb` (the entrypoint then runs `php artisan reverb:start --host=0.0.0.0 --port=8080`) |
   | Exposed port | `8080` |
   | Domain | `https://ws.<your-domain>` (a DNS record pointing at the Coolify server; Traefik issues the certificate) |
   | Environment / secrets | the **same** Infisical values as the app (the entrypoint loads them), see below |

   If your app is deployed from `docker-compose.yml` instead, the `reverb` service in it is the same thing;
   give it a domain in Coolify the way you do for the app.

2. **Secrets.** Generate fresh values per environment; never reuse the legacy Pusher credentials. They must be
   identical for the app, queue worker and Reverb containers.

   | Variable | Value |
   | --- | --- |
   | `REVERB_APP_ID` | any unique id, e.g. `hibarr-crm-staging` |
   | `REVERB_APP_KEY` | random, `openssl rand -hex 16` (public: shipped to the browser) |
   | `REVERB_APP_SECRET` | random, `openssl rand -hex 32` (server only) |
   | `REVERB_HOST` | `ws.<your-domain>` (what browsers connect to) |
   | `REVERB_PORT` | `443` |
   | `REVERB_SCHEME` | `https` |
   | `REVERB_PUBLISH_HOST` / `_PORT` / `_SCHEME` | the Reverb container's **internal** address, e.g. `reverb-<id>` / `8080` / `http` (the internal hostname is shown in Coolify). Optional: if unset, the app publishes through the public address, which only works if the containers can reach their own public domain. |
   | `REVERB_ALLOWED_ORIGINS` | the **CRM's** hostname(s), comma separated, e.g. `crm.example.com` (hostnames, not URLs; defaults to the host of `APP_URL`). Not the `ws.` host: it is the page's origin that is checked. |
   | `NOTIFICATIONS_REALTIME_ENABLED` | `true` (the server-side kill switch; app and queue worker) |

3. **Redeploy** the app, the queue worker and the Reverb resource so they all pick up the values.

4. **Feature flag.** Turn on `crm.realtime-notifications` in the feature-flag service. It also needs
   `crm.notification-island-alerts` (the popup surface). The flag is global, not per user, so rollout is
   all-or-nothing: try it on staging first.

Notes for this setup:

- If the `ws.` domain is ever routed *through* the `coolify-nginx-reverse-proxy` container instead of straight to
  Traefik, that hop must forward the WebSocket upgrade (`Upgrade` / `Connection: upgrade` headers, HTTP/1.1) and
  allow idle connections for at least 120 s (Reverb pings every 60 s).
- Containers normally get a very high open-file limit, so the descriptor limit that matters on a plain host is not
  an issue here.

### Host deployments (Jenkins + supervisor), if you still have any

`scripts/fix_for_supervisor_reverb.sh` (called from the Jenkinsfile) runs Reverb under supervisor on a host and
restarts it on every deploy. It is a no-op until `REVERB_APP_KEY` is in the host `.env`. On such a host you must
also proxy `/app` and `/apps` to `127.0.0.1:8080` with WebSocket upgrade headers in whatever proxy fronts it, and
raise supervisor's `minfds` (default 1024 descriptors, one per browser tab). Not needed on Coolify.

## Verifying

- The Reverb container is running and its logs show `Starting server on 0.0.0.0:8080`.
- In a browser, devtools → Network → WS shows one connection to `wss://ws.<your-domain>/app/<key>`, status `101`, and a frame
  `pusher_internal:subscription_succeeded` for `private-notifications.<userId>`.
- Create any notification for yourself: the popup appears within about a second, with no `unread-summary` polling
  in the Network tab (one initial request, and `since` on connect).
- If the socket stays closed, check in this order: DNS/certificate for the `ws.` host, `REVERB_ALLOWED_ORIGINS`
  (a wrong value is refused at connect), the key in the browser matching `REVERB_APP_KEY`, then the container logs.

## Rolling back

| Want | Do | Effect |
| --- | --- | --- |
| Back to polling for everyone, instantly | turn off `crm.realtime-notifications` | the next page load / Inertia visit polls again |
| Stop publishing, keep the server | `NOTIFICATIONS_REALTIME_ENABLED=false` (app and queue worker) | nothing is broadcast; browsers fall back to the slow catch-up timer |
| Remove the server | stop the Reverb resource | browsers fall back to the slow catch-up timer |

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
  One process comfortably serves thousands of idle sockets.
- **Several tabs per user** each hold a socket. One tab per user plays the sound / OS popup (Web Locks
  election); every tab updates its own view.
- **Secret rotation:** change `REVERB_APP_SECRET` (and the key if wanted) on all three containers and redeploy;
  browsers reconnect with the new `key` from the next page load, and the old one stops working at once.
- **Legacy chat / taskboard** still use hosted Pusher from the `pusher_settings` row and are untouched.
