# CRM Reliability — SLOs & Burn-Rate Alerting

Status: **draft — targets below need stakeholder sign-off** (see Acceptance Criteria item 1).
Backing telemetry: OTel request tracing (`App\Http\Middleware\OpenTelemetryTraceMiddleware`) → Signoz OTel Collector → spanmetrics → `signoz_calls_total` / `signoz_latency_bucket`.

## 1. Scope: which endpoints count as "critical"

`hibarr-crm` is a CRM, not a storefront — "checkout endpoints" in the original ticket text doesn't map to anything here. The critical-path scope for the **latency** SLO is:

- Deal create/update/show (`DealController`)
- Lead create/update/show (`LeadController`)
- Auth (login/session)

**Availability** and **error rate** are scored system-wide (all HTTP requests to `service.name="hibarr-crm"`), matching the original ticket's "System-wide HTTP 5xx error rate" language — narrowing those two to the same three routes would hide problems everywhere else.

## 2. SLIs and SLO targets

| SLI | Definition | Target | Window |
|---|---|---|---|
| Availability | non-5xx responses / total responses | 99.9% | Rolling 30 days |
| Latency (critical routes) | requests completing in <200ms | p99 | Rolling 30 days |
| Error rate | 5xx responses / total responses | <0.1% | Per day |

**Note on availability vs. error rate:** these two rows measure the *same underlying signal* (proportion of 5xx responses) over different windows — 99.9%/30-day and <0.1%/day are mathematically the same threshold, just expressed two ways. Ship both as separate dashboard panels (the ticket asks for both explicitly), but drive burn-rate alerting off a **single** error-budget policy based on the 30-day figure (§4) rather than maintaining two independent alerting pipelines that could disagree with each other.

## 3. Instrumentation status

Traces are now emitted per-request (see `app/Http/Middleware/OpenTelemetryTraceMiddleware.php`, gated behind `OTEL_TRACES_ENABLED`). What that gives Signoz to query, once `OTEL_TRACES_ENABLED=true` is set against the live collector:

- `signoz_calls_total{service_name="hibarr-crm", operation, http_status_code, deployment_environment_name, host_name}`
- `signoz_latency_bucket{...same labels...}`

`operation` is the span name, which is `{METHOD} {route pattern}` (e.g. `GET deals/{deal}`) — not the resolved path with real IDs, so cardinality stays bounded. This is what the "critical routes" filter in §5 matches against. **Before wiring the dashboard for real, confirm the actual `operation` values Signoz is receiving** (Traces Explorer, filter by `service.name = hibarr-crm`) — route naming assumptions below (`deals`, `leads`, `login`) need to match what's actually in the route list, not guessed.

`deployment_environment_name` and `host_name` are resource attributes (not per-span), so the environment/hostname dashboard variables (ticket requirement) work as global filters.

## 4. Error budget & burn-rate alerting

30-day SLO of 99.9% → error budget = 0.1% of requests = **43.2 minutes of budget per 30-day window**.

Burn rate = (observed error rate) / (budget error rate). A burn rate of 1.0 exactly exhausts the budget in exactly 30 days; higher multiples exhaust it proportionally faster.

The ticket's literal wording ("Critical if on track to burn 100% of the budget in 1 hour; Warning if on track for 6 hours") works out to burn-rate thresholds of **720x** and **120x** respectively — both correspond to something close to a full outage, which means Critical would only fire on a near-total outage and Warning barely more forgiving. That's very late to page anyone.

The industry-standard alternative (Google SRE workbook's multi-window, multi-burn-rate policy, tuned for a 99.9%/30-day SLO) catches problems earlier while still avoiding alert fatigue on transient blips, by requiring the burn rate to hold across **two windows simultaneously** (a long window for signal, a short window so the alert clears quickly once resolved):

| Severity | Burn rate | Long window | Short window | Budget consumed if sustained |
|---|---|---|---|---|
| Critical (page) | ≥ 14.4x | 1h | 5m | 2% of 30-day budget in 1h |
| Warning (ticket) | ≥ 6x | 6h | 30m | 5% of 30-day budget in 6h |

**Recommendation:** use the Google SRE numbers (14.4x / 6x), not the literal 720x / 120x reading — flagging this explicitly for the stakeholder sign-off called out in Acceptance Criteria item 1, since it changes what "Critical" actually means operationally.

### PromQL (paste directly into a Signoz PromQL alert — see §6 on why not raw alert-JSON)

Critical:
```promql
(
  sum(rate(signoz_calls_total{service_name="hibarr-crm", http_status_code=~"5..", deployment_environment_name="$environment"}[1h]))
  /
  sum(rate(signoz_calls_total{service_name="hibarr-crm", deployment_environment_name="$environment"}[1h]))
) > (14.4 * 0.001)
and
(
  sum(rate(signoz_calls_total{service_name="hibarr-crm", http_status_code=~"5..", deployment_environment_name="$environment"}[5m]))
  /
  sum(rate(signoz_calls_total{service_name="hibarr-crm", deployment_environment_name="$environment"}[5m]))
) > (14.4 * 0.001)
```

Warning: identical shape, windows `6h` / `30m`, threshold `6 * 0.001`.

## 5. Dashboard panel queries

All filtered by `deployment_environment_name="$environment"` (Signoz template variable, `CUSTOM` type, values `production`/`staging`).

`$hostname` is defined as a dashboard variable (free-text, for isolating a single instance) but **not** pre-wired into the panel queries below — a blank text variable would turn into `host_name=""` and match nothing by default. To use it: add `, host_name="$hostname"` to a panel's query while investigating a specific host, or convert the variable to a proper dropdown (Signoz `QUERY` type) once real `host_name` values are visible in the Traces Explorer.

- **RPS**: `sum(rate(signoz_calls_total{service_name="hibarr-crm"}[5m]))`
- **Availability %**: `sum(rate(signoz_calls_total{service_name="hibarr-crm", http_status_code!~"5.."}[5m])) / sum(rate(signoz_calls_total{service_name="hibarr-crm"}[5m])) * 100`
- **Error rate (4xx / 5xx)**: same shape, `http_status_code=~"4.."` / `"5.."`
- **Latency p50/p95/p99**: `histogram_quantile(0.PP, sum(rate(signoz_latency_bucket{service_name="hibarr-crm"}[5m])) by (le))`
- **Latency p99, critical routes only**: add `operation=~"^(GET|POST|PUT|PATCH|DELETE) (deals|leads|login).*"` — **verify this regex against real `operation` values first** (§3).

Threshold lines: 200ms on the critical-route latency panel, 99.9% on availability, 0.1% on error rate.

## 6. Why alerts aren't shipped as importable JSON

Signoz's alert-rule JSON schema isn't publicly documented, and there's an open upstream issue (SigNoz/signoz#10823) where alert rules created via the API don't reliably fire due to a builder/ruler query mismatch. Rather than ship a JSON payload that might silently fail, §4's PromQL is meant to be pasted into Alerts → New Alert → PromQL in the UI, which is the reliably-working path.

On trace-ID linking (Acceptance Criteria: "attach links to corresponding distributed traces"): this applies cleanly to a **trace-based** alert (e.g. "any single request over 200ms" — Signoz can attach an example trace ID that breached it) but not to an aggregate rate-based burn-rate alert, where no single trace is "the" cause of a rate crossing a threshold. For burn-rate alerts, the practical equivalent is a notification link into the Traces Explorer pre-filtered to `service.name=hibarr-crm`, the breached status/route, and the alert's time window — gets an on-call engineer to the relevant traces in one click rather than a specific trace ID. Recommend adding a companion trace-based alert on p99 latency for the critical routes specifically if per-incident trace IDs in the notification matter for that path.

## 7. Open items requiring stakeholder input

- [ ] Sign off on burn-rate thresholds: Google SRE standard (14.4x/6x, recommended) vs. ticket's literal reading (720x/120x)
- [ ] Confirm actual route patterns for the "critical routes" latency filter once traces are flowing
- [ ] Confirm notification channels (Slack webhook / email addresses) for Critical vs. Warning
