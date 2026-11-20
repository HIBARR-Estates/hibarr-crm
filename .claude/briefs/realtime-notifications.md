# Realtime notifications (push over WebSockets, replacing poll-and-diff)

Status: **implemented** (2026-11-19), behind `crm.realtime-notifications` + `NOTIFICATIONS_REALTIME_ENABLED`, off by default.
Operations: `docs/realtime-notifications-ops.md`. The plan below is kept as written; "What was built" lists where the build differs from it.
Prompt against this file per phase, e.g. "Implement Phase 2 of `.claude/briefs/realtime-notifications.md`".

## Goal

A notification popup appears because the server pushed "this notification was just created for you",
not because the browser polled the top 6 unread rows and diffed them against a seen-ID set.
The `notifications` table row stays the source of truth; the socket is the delivery path; a cursor-based
catch-up covers whatever the socket missed.

## What was built (and where it differs from the plan)

All phases 0–3 are in. Phase 4 (deleting the poll-and-diff code) is deliberately **not** done: it is still the
path when the flag is off or Reverb is not provisioned. Delete it after the flag has been on in production.

**Verified.** 42 PHP tests and 14 JS tests pass. A real-browser run against a real Reverb server, the real
`->notify()` pipeline and the real frontend code passed 21/21 checks: push latency ~260–360 ms including the HTTP
request that creates the notification; zero polling requests over 35 s idle; burst of 6 → one card + one
"5 new notifications" summary; joinable meeting jumps the queue; one push reaches two tabs and read state syncs;
a notification created between two page loads pops after the reload; a notification created while Reverb was
down is recovered after it returned (~13 s, pusher-js reconnect backoff).

### Differences from the plan
1. **No Laravel Echo.** `pusher-js` is used directly (`lib/realtime/connection.ts`): fewer layers, and Echo was never
   loaded on the Vite pipeline anyway. Event names are bound without Echo's leading dot.
2. **Broadcast auth is its own endpoint** (`POST /account/realtime/auth`, `RealtimeAuthController`). The plan missed that
   the stock `/broadcasting/auth` signs with the *default* (legacy Pusher) broadcaster and `routes/channels.php`
   registers callbacks only there, so a Reverb subscription would be rejected. The controller signs with the
   realtime connection's own secret and authorizes exactly one channel: the caller's own `private-notifications.{id}`.
3. **`time_ago` is kept in the payload** (the plan said drop it): the bell renders it and it is localized server-side.
4. **Reverb config is published** (`config/reverb.php`) with `allowed_origins` restricted to hostnames (default: the host
   of `APP_URL`, fails closed) and `accept_client_events_from = none`. Origins are *hostnames*, not URLs.
5. **Catch-up route** is `GET /account/api/notifications/since` (named `notifications.api.since`).
6. **`laravel/reverb` was added to `composer.json`/`composer.lock`** (12 packages, nothing existing updated). Publishing needs
   only `pusher-php-server`; the package is just the socket server.
7. **Backlog rules live in a pure module** (`lib/notificationAlertQueue.ts`), tested without React.
8. **A provider bug was fixed on the way** (also affects the legacy polling path): `NotificationAlertProvider` returned a
   different tree shape while a popup was showing, so React unmounted and remounted everything under it (the whole
   page) each time a popup appeared or went away. The provider now renders a constant shape.
9. **Desktop-popup decision (open decision 1):** unchanged behaviour. They need an explicit browser permission grant
   (requested by a click in the bell) and only fire when the tab is hidden. OS popups are capped at 3 per batch and
   are keyed by notification id (they were keyed by link, so two notifications about one deal replaced each other).
10. **Collapse threshold (open decision 2):** more than 3 waiting collapse into one summary card (`COLLAPSE_AFTER`).
11. **Reverb vs hosted Pusher (open decision 3):** self-hosted Reverb, as recommended.

### Deployment target (updated)
Staging runs on **Coolify (Traefik)** with the app behind a `coolify-nginx-reverse-proxy` container, not on a host
with nginx + supervisor as the plan assumed. Reverb therefore runs as its own container (the entrypoint `reverb`
role) on its own subdomain routed by Traefik straight to it (WebSocket upgrades are native), and the app publishes
to it over the internal address via `REVERB_PUBLISH_*`. The nginx and supervisor instructions in this file's
"Design" section no longer apply there; `docs/realtime-notifications-ops.md` is the current runbook.

### Known limits
- Reconnect after a Reverb restart takes up to ~13 s (pusher-js backoff); notifications are not lost, they appear when it reconnects.
- `time_ago` in the bell is as of arrival and refreshes on the next fetch.
- The sound/OS-popup "leader" tab may be a background tab; with several tabs the OS popup can come from a hidden one while another is visible.
- Production still needs the host-side steps in the ops doc (secrets, nginx `location /app`, `minfds`) and rotating the legacy Pusher secret.

## Facts this plan relies on (checked in code / framework source)

| Fact | Where |
| --- | --- |
| `NotificationSent::$response` is the created `DatabaseNotification` for the `database` channel | Laravel 10.50 `NotificationSender::sendToNotifiable`, `DatabaseChannel::send` |
| `ShouldBroadcastNow` broadcasts inline (`dispatchNow`); Pusher-protocol API errors throw `BroadcastException` | `BroadcastManager::queue`, `PusherBroadcaster::broadcast` |
| `ShouldDispatchAfterCommit` defers listeners **and** broadcasting until commit | `Events\Dispatcher::dispatch` / `invokeListeners` |
| `broadcastVia()` / `InteractsWithBroadcasting` exists, so an event can pin its connection | Laravel 10.50 `Broadcasting/InteractsWithBroadcasting.php` |
| `NotificationSender` only switches locale if the notifiable implements `HasLocalePreference`; `User` does not; `users.locale` exists | `User.php`, worksuite migration |
| `BroadcastServiceProvider::register()` overwrites `broadcasting.default` from the `pusher_settings` row in every env except demo/development | `app/Providers/BroadcastServiceProvider.php` |
| Prod/staging are **not** docker: Jenkins SSH, atomic symlink, supervisor (`numprocs=1` worker), cron scheduler, systemd RoadRunner | `Jenkinsfile` steps 4–9, `scripts/fix_for_supervisor_atom_deploy_prod.sh` |
| Cron also runs `queue:work --stop-when-empty` (a second worker, only guarded against itself) | `Console/Kernel.php` |
| `notifications.created_at` is second precision; `id` is a random UUIDv4 | worksuite migration / `mysql-schema.dump` |
| `resources/js/inertia.tsx` is built by **both** Vite and Mix; Mix's `layouts/inertia.blade.php` has no `csrf-token` meta | `webpack.mix.js:86`, layouts |
| Alert side effects (sound, desktop popup, seen-ID diff) live in the shared `useNotificationSummary`, used by the island bridge, `NotificationDropdown` (PageLayout) and `AgentNotificationBell` | `Hooks/useNotifications.ts` |
| Impersonation swaps the session's guard user and migrates the session (new CSRF token) | `EmployeeImpersonationService::assume` |
| Reverb 1.13.x supports Laravel `^10.47` + PHP `^8.2` (1.14 needs L12); lock is compatible (prompts 0.1.25, symfony 6.4) | Packagist, `composer.lock` |
| Reverb defaults: `max_message_size` 10 000 bytes, `allowed_origins` `*`, `ping_interval` 60, `activity_timeout` 30 | reverb v1.13.0 `config/reverb.php` |
| `NewDiscussionReply` stores the full reply body in `data` (can exceed 10 KB) | `app/Notifications/NewDiscussionReply.php` |
| `FeatureFlagService::isEnabled` is global (no per-user targeting) and calls a remote API; `BaseNotification` deliberately avoids flag calls in workers | `app/Services/FeatureFlagService.php`, `BaseNotification::$unsRoutingEnabled` |

Not verified: the production `pusher_settings` row (status/creds), production nginx config (not in repo),
whether `InnerProviders` remounts on Inertia visits.

## Audit of the previous plan — what was wrong and what changed

### Would have caused damage
1. **Inline broadcast inside the notification job.** `ShouldBroadcastNow` in a `NotificationSent` listener throws on any
   Reverb/Pusher error → the queued notification job fails → `--tries=3` re-runs **every channel** → duplicate DB rows,
   duplicate pushes, duplicate emails/Slack. A hung socket server would also stall the single prod worker.
   → Listener catches `Throwable`, `report()`s, never rethrows; broadcaster Guzzle client gets explicit short timeouts.
2. **"Unify config on env" fights `BroadcastServiceProvider`.** Setting `BROADCAST_DRIVER=reverb` is silently overwritten
   to `pusher`/`null` from the DB row. Changing that provider would also break legacy chat (`push-setting-include.blade.php:149`
   `new Pusher(...)`) and taskboard, which run on hosted Pusher.
   → Leave the legacy default alone. New events pin `broadcastVia('reverb')`. Legacy chat migration is out of scope.
3. **Infra targeted docker-compose.** Prod/staging deploy to hosts via supervisor.
   → Reverb is a supervisor program added to both `fix_for_supervisor*` scripts and restarted in Jenkins step 8
   (a long-running process otherwise keeps running the old release, whose directory step 9 deletes).
   docker-compose gets a `reverb` service for local dev only.
4. **Payload could exceed the 10 KB message limit** (full `formatNotification()` incl. `data`). Oversized messages are rejected,
   so the popup is silently lost.
   → Slim payload: only the `data` keys `mapNotificationToAlert` reads, text truncated, size-checked; above 8 KB send id-only and
   let the client hydrate via the catch-up endpoint.
5. **Wrong-language titles.** Formatting runs in the worker's default locale (`__()` in `getNotificationTitle`), while the bell
   (REST) is localized.
   → Format inside `withLocale($user->locale ?? app default)`.
6. **Cursor skipped rows.** `(created_at, id)` with second precision + random UUIDs drops a same-second row whose UUID sorts lower.
   → Catch-up re-reads from `cursor_ts − 5 s`; the client applies items idempotently by id (at-least-once delivery + idempotent
   consumer). This set only de-duplicates; it never decides what is new — the server event or the cursor does.
7. **Double alerts.** Removing the bridge leaves the sound/desktop/seen-diff effect inside `useNotificationSummary`, still polled by
   the dropdown and agent bell → poll chime + push chime.
   → Strip side effects out of `useNotificationSummary`; drop `refetchInterval` at all three call sites (flag-gated).
8. **N tabs = N chimes.** Push reaches every tab at once (polling staggered them).
   → Leader election with Web Locks (`navigator.locks.request('crm-notification-leader')`): the leader plays the sound and shows
   the OS popup; every tab updates its UI. Fallback without Web Locks: every tab alerts (today's behaviour).
9. **Desktop popups will start firing for real.** Today hidden tabs don't poll (`refetchIntervalInBackground` unset → false) and
   `showDesktopNotification` only fires when `document.hidden`, so OS popups almost never appear. With push they will, for every
   user who granted permission long ago. → Product decision (see below) + release note.

### Wrong or incomplete
10. Config must not use `import.meta.env` (Mix builds the same entry); it comes from an Inertia shared prop. The channel authorizer
    must post through axios (XSRF cookie), not the `csrf-token` meta: Mix's layout lacks it and impersonation rotates the token.
11. Impersonation start/leave changes the user under a live socket → connection is keyed by `auth.user.id`; on change, disconnect,
    resubscribe, reset cursor.
12. No server-side flag check (worker convention, remote call). Server broadcasts whenever the `reverb` connection is configured
    (env kill switch `NOTIFICATIONS_REALTIME_ENABLED`); the client subscribes only when `crm.realtime-notifications` is on.
    The flag is global, so rollout is all-or-nothing.
13. "Red jumps the queue" was the wrong rule: red = tickets / rejected leave. Priority is by kind: a meeting that can be joined now
    (`isMeetingStartingNow`) first; time-critical items are never collapsed.
14. Reverb `allowed_origins` must be restricted to the app host(s).
15. Unread count from events can arrive out of order (cron drain worker + supervisor worker) → client adjusts counts locally,
    takes server counts from `notification.read`, and keeps `refetchOnWindowFocus` on the summary as reconciliation.
16. Secret rotation alone doesn't take effect: `pusher_settings()` caches the model in the session, so legacy `triggerPusher` keeps
    the old secret until sessions expire. Exposure includes client-portal users (same `layouts/app.blade.php`).
17. The dropdown "acknowledged IDs" set is a product feature (badge = arrived since last open), not a polling hack — keep it.
    Only the island seen-ID machinery goes.
18. The connection must be a module singleton with ref-counted subscriptions so a provider remount doesn't reconnect.
19. Pre-existing, now more visible: a notification job that fails after the DB insert retries and creates a second row → a second
    push. Not introduced here; fixing it (idempotent notification ids) is a separate task.

## Design

### Server
- **Listener** `BroadcastDatabaseNotification` on `NotificationSent`:
  `channel === 'database'`, `$notifiable instanceof User`, `$response instanceof DatabaseNotification`, kill switch on.
  Builds the payload in the user's locale and dispatches `UserNotificationCreated`. Wraps everything in `try/catch` → `report()`.
  Bypass (`SuppressBypassedNotification`) and actor suppression already run before the row exists — no extra work.
- **Events** (`ShouldBroadcastNow`, `ShouldDispatchAfterCommit`, `broadcastVia('reverb')`), private channel `notifications.{userId}`:
  - `notification.created` → `{ notification: <slim payload>, unread_count }`
  - `notification.read` → `{ ids: [...] | all: true, unread_count }` from `NotificationService` mark-read methods.
- **Channel auth** in `routes/channels.php`: `notifications.{userId}` → `(int) $user->id === (int) $userId`.
- **Payload builder** `NotificationBroadcastPayload`: `formatNotification()` minus `time_ago`, `data` reduced to the keys used by
  `mapNotificationToAlert` (`deal_name, event_name, item_name, heading, subject, title, name, from_name, entity_type, deal_id,
  lead_id, task_id, project_id, ticket_number, invoice_number, reminder_id, follow_up_id, id, meeting_link, event_link, remind_at,
  starts_now, source`), `text` capped; if JSON > 8 KB → `{ id, created_at, truncated: true }`.
- **Catch-up** `GET notifications/api/since?cursor=<opaque>`: unread rows with `created_at >= cursor_ts - 5s`, ascending, max 50,
  plus `unread_count`, `next_cursor`, `server_time`. Same slim payload.
- **Connection** `reverb` in `config/broadcasting.php` with `client_options` timeouts (connect ~1 s, total ~2 s).

### Client (works on both Vite and Mix builds)
- `lib/realtime/connection.ts`: module singleton, dynamically imported after first paint; config from Inertia shared prop
  `realtime` (`key, host, port, scheme` — never a secret); axios-based authorizer; keyed by user id; ref-counted channel subscriptions.
- `useNotificationStream` (mounted once inside `NotificationAlertsGate`):
  `notification.created` → upsert into the unread-summary cache (exact key `[path, undefined]`) + enqueue alert;
  `notification.read` → remove + dismiss; on connect/reconnect → `since` (cursor in `sessionStorage`, first-ever load = `server_time`,
  no alerts); while disconnected only, `since` every 60 s.
- **Alert queue** in `NotificationAlertProvider`: one card at a time, FIFO; join-able meetings first; more than 3 waiting (excluding
  time-critical) collapse into one "N new notifications" card → inbox. New lang keys in eng/de/tr/ru + bump `I18N_DICT_VERSION`.
- **Side-effect leader** via Web Locks for sound + OS popup; OS popup `tag` = notification id.
- `useNotificationSummary` loses its alert effect; when the flag is on, all three callers drop `refetchInterval`.

### Infra
- `composer require laravel/reverb` (resolves 1.13.x on Laravel 10). Env/Infisical: `REVERB_APP_ID/KEY/SECRET`, host/port,
  `allowed_origins`.
- Supervisor program `hibarr_crm_reverb` (`php artisan reverb:start`) in both `fix_for_supervisor*` scripts; restart it in Jenkins step 8.
- Host nginx (ops, not in repo): WS `location` with `Upgrade`/`Connection` headers, `proxy_read_timeout` ≥ 120 s.
- Raise open-file limits for the Reverb process. Single instance (no Redis in the stack, so no horizontal scaling).
- docker-compose: `reverb` service for local dev.

## Phases
0. **Pusher secret** — `$hidden` on `PusherSetting` (expose only what legacy JS reads), stop session-caching the secret,
   then rotate in Pusher and update the row. First check the prod row's status/creds to size the exposure.
1. **Reverb running** — package, config, `reverb` connection with timeouts, supervisor + Jenkins restart, nginx runbook, compose service.
   `BroadcastServiceProvider` untouched.
2. **Server** — listener, events, channel, payload builder, `since` endpoint, read events, kill switch.
   Tests: listener stores the row and swallows a throwing broadcaster; bypassed notification → no event; payload ≤ 8 KB and id-only
   fallback; locale; channel auth (like `ChatChannelsTest`); `since` overlap includes same-second rows.
3. **Client behind `crm.realtime-notifications`** (add to `config/features.php`) — connection, stream, queue, leader, summary-hook
   cleanup. Flag off = today's behaviour unchanged. E2E with Playwright against local Reverb: two tabs, one chime; reload gap
   recovered; burst of 10 → one collapsed card.
4. **Flip, observe, delete** — remove `takeUnseenNotifications`, `seedIslandSeenNotifications`, `hasSeededIslandSeenIds`,
   island seen-ID storage and the bridge poll.

## Decisions needed
1. OS desktop popups: on for everyone who already granted permission, or off until re-enabled in Preferences?
2. Collapse threshold (default: more than 3 waiting).
3. Confirm self-hosted Reverb over hosted Pusher (Reverb keeps lead/deal names in-house; hosted Pusher needs no host changes).

## Out of scope
Legacy Blade screens (no island today), migrating legacy chat/taskboard to Reverb, duplicate rows from notification job retries.
