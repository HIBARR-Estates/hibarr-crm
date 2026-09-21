# CRM -> OL deal/lead sync: operations runbook

OL keeps a shadow copy of every CRM Deal/Lead (`crm_deals`, leads), fed by webhook events:
`CrmEvent` -> `DispatchOlWebhookJob` (queue `ol_webhooks`) -> OL ingest (202 = queued only) -> OL `crm-event-sync` worker.

Payment requests no longer depend on this landing in time: `POST /internal/payments/deal-requests` carries a deal
snapshot and OL creates the shadow row synchronously if it is missing (OL logs
`[PAYMENT] Shadow deal missing at payment request` when that fallback fires — a high rate means the sync is unhealthy).
Everything else that reads OL's copy still relies on the sync, so keep it healthy.

## Health checks

- Delivery state per record: `select status, origin, count(*) from ol_webhook_deliveries group by 1,2;`
  - `sent` — OL accepted it. `pending`/`failed` — queue is retrying. `exhausted` — retries used up.
    `rejected` — OL returned a non-retryable 4xx (or the payload was unmapped); never retried automatically.
- Log alerts: `DispatchOlWebhookJob: non-retryable webhook failure`, `DispatchOlWebhookJob: webhook delivery exhausted retries`,
  `OL webhook reconcile: giving up on record` (needs a human — usually a payload OL keeps rejecting).

## Retry / self-heal

- Delivery retries: `OL_WEBHOOK_TRIES` (default 5) with `OL_WEBHOOK_BACKOFF` (default `5,30,120,600,1800` seconds).
- `php artisan ol-webhook:reconcile` runs every 15 minutes (scheduler must be running). It re-emits `deal_created` /
  `lead_created` for records with no `sent` delivery and none in flight (`--grace`, default 30 min), and gives up after
  `--max-attempts` (default 3) reconcile attempts per record. Try `--dry-run` first.

## One-off backfill

- `php artisan ol-webhook:backfill --dry-run` then run without `--dry-run` (optionally `--company=<id>`), for records that
  pre-date the sync. Run it for every company where `packages.online-payment` is enabled.

## Prerequisites per company

- Feature flag `sales.crm-lead-deal-sync` on, plus `OL_WEBHOOK_ENABLED=true`, `OL_WEBHOOK_ENDPOINT`, `OL_WEBHOOK_API_KEY`.
- Deploy order for the payment-snapshot change: OL first (accepts the optional `deal` field), then CRM.
