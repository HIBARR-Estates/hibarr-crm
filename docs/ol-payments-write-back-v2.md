# OL Integration Guide — CRM Payments Write-back API (v2)

Audience: engineers on **hibarr-backend / OL** who need to push package payment state into CRM so agents can review website-originated payments (including manual bank-transfer proof) on the existing Payment surface.

OL owns the Payment record as source of truth and writes state into CRM via this resource. CRM does **not** pull from OL.

**Base path:** `{CRM_BASE_URL}/api/v2`

---

## 1. Authentication & tenancy

**Yes — these endpoints are company API-token protected**, same as the other CRM write (`tasks` / `notes` / `meetings`) routes.

Middleware stack:

| Middleware | Role |
|---|---|
| `api.token` (`ApiTokenAuth`) | Requires a valid CRM API token; resolves company; enforces token scopes |
| `crm.write.client` | Feature gate: `sally.crm-write-client` must be enabled (otherwise **404**) |

### Required headers

| Header | Required | Description |
|---|---|---|
| `X-API-TOKEN` | Yes* | Plaintext CRM API token |
| `Authorization: Bearer {token}` | Yes* | Alternative to `X-API-TOKEN` |
| `X-COMPANY-ID` | Strongly recommended | Numeric company id. Must match the token’s bound `company_id` when the token is company-scoped |

\* Provide **one** of `X-API-TOKEN` or `Authorization: Bearer …`.

There is **no** user session / cookie auth on these routes. This is system-to-system only.

### Auth failure codes

| Status | When |
|---|---|
| `401` | Missing/invalid/revoked token, or `X-COMPANY-ID` mismatches the token’s company |
| `403` | Token is scope-restricted and lacks the route’s scope |
| `404` | Feature flag `sally.crm-write-client` is off (intentional opaque response) |

### Required scopes (restricted tokens)

Unrestricted tokens (null / empty permissions) retain full access.

Restricted tokens must include:

```text
api.v2.payments.upsert
api.v2.payments.index
api.v2.payments.show
```

---

## 2. Endpoints

| Method | Path | Route name | Purpose |
|---|---|---|---|
| `POST` | `/api/v2/payments` | `api.v2.payments.upsert` | Create or update a Payment (upsert) |
| `GET` | `/api/v2/payments` | `api.v2.payments.index` | List payments (paginated) |
| `GET` | `/api/v2/payments/{paymentId}` | `api.v2.payments.show` | Fetch one payment by CRM id |

There is **no** `PUT`/`PATCH`/`DELETE` on this resource. Lifecycle updates are always `POST` with the same `external_reference`.

---

## 3. Upsert — `POST /api/v2/payments`

Idempotent on `(company_id, external_reference)`.

- First call with a new `external_reference` → **201** + creates a CRM `payments` row linked to `deal_id`
- Later calls with the same `external_reference` → **200** + updates that row in place (no duplicates)

Use OL’s internal payment id as `external_reference` (e.g. call once on proof-submitted, again on approved/rejected, once for digital completion).

### Request body (JSON)

`Content-Type: application/json`

| Field | Type | Required | Notes |
|---|---|---|---|
| `deal_id` | integer | Yes | CRM Deal id. Unknown deal → **404**, no row created |
| `external_reference` | string (max 255) | Yes | OL payment id — upsert key |
| `amount` | number | Yes | `>= 0`; stored rounded to 2 decimals |
| `currency` | string | Yes | ISO currency code (e.g. `USD`, `EUR`). Must exist for the company; unknown → **422** |
| `status` | string | Yes | See status mapping below |
| `gateway` | string (max 255) | Yes | Originating provider key, e.g. `manual-bank-transfer`, `nowpayments` |
| `paid_on` | date/datetime | No | If omitted and status resolves to `complete`, CRM sets `paid_on` to now on create (or when previously null) |
| `transaction_id` | string | No | Optional gateway / bank reference |
| `proof_url` | URL | No | HTTPS URL CRM will download and store as the receipt (`bill`) |

### Multipart proof upload (alternative)

`Content-Type: multipart/form-data`

Same fields as above, plus optional file field:

| Field | Type | Notes |
|---|---|---|
| `bill` | file | `jpg`, `jpeg`, `png`, `pdf`, `webp`; max **10 MB** |

If both `bill` and `proof_url` are sent, **multipart `bill` wins**. Omitting proof on a later upsert leaves the existing receipt unchanged.

Proof is stored on CRM’s Payment `bill` field under folder `payment-receipt` (not DealFile).

### Status values

CRM stores one of: `pending` | `complete` | `failed`.

Aliases accepted on input (normalized before validate):

| OL / alias | Stored as |
|---|---|
| `pending` | `pending` |
| `proof_submitted` / `proof-submitted` | `pending` |
| `complete` | `complete` |
| `approved` | `complete` |
| `failed` | `failed` |
| `rejected` | `failed` |

### Example — create / proof submitted

```bash
curl -X POST "{CRM_BASE_URL}/api/v2/payments" \
  -H "X-API-TOKEN: {token}" \
  -H "X-COMPANY-ID: {companyId}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "deal_id": 12345,
    "external_reference": "ol-pay-1001",
    "amount": 1500.00,
    "currency": "USD",
    "status": "proof_submitted",
    "gateway": "manual-bank-transfer",
    "proof_url": "https://cdn.example.com/proofs/ol-pay-1001.pdf"
  }'
```

### Example — later approval (same external_reference)

```bash
curl -X POST "{CRM_BASE_URL}/api/v2/payments" \
  -H "X-API-TOKEN: {token}" \
  -H "X-COMPANY-ID: {companyId}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "deal_id": 12345,
    "external_reference": "ol-pay-1001",
    "amount": 1500.00,
    "currency": "USD",
    "status": "approved",
    "gateway": "manual-bank-transfer"
  }'
```

### Success response shape

```json
{
  "status": "success",
  "message": "Payment created successfully",
  "data": {
    "id": 42,
    "deal_id": 12345,
    "deal": {
      "id": 12345,
      "name": "Package Deal",
      "value": 1500,
      "stage": { "id": 1, "name": "New" },
      "pipeline": { "id": 1, "name": "Default" }
    },
    "amount": 1500,
    "currency": "USD",
    "currency_id": 5,
    "status": "pending",
    "gateway": "manual-bank-transfer",
    "external_reference": "ol-pay-1001",
    "transaction_id": null,
    "paid_on": null,
    "bill": "a1b2c3d4.pdf",
    "file_url": "https://…/payment-receipt/a1b2c3d4.pdf",
    "created_at": "2026-08-06T15:00:00+00:00",
    "updated_at": "2026-08-06T15:00:00+00:00"
  }
}
```

| HTTP | Meaning |
|---|---|
| `201` | Created |
| `200` | Updated existing row |

---

## 4. List — `GET /api/v2/payments`

### Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `deal_id` | integer | — | Filter to one Deal |
| `page` | integer | `1` | |
| `per_page` | integer | `20` | Max `100` |

### Response (pagination matches tasks/notes/meetings)

```json
{
  "status": "success",
  "message": "Payments fetched successfully",
  "data": [ /* payment objects as above */ ],
  "current_page": 1,
  "last_page": 1,
  "per_page": 20,
  "total": 1,
  "from": 1,
  "to": 1
}
```

---

## 5. Show — `GET /api/v2/payments/{paymentId}`

`paymentId` is the **CRM** payment id (integer), not `external_reference`.

- Found → `200` + `{ status, message, data: { …payment } }`
- Missing / other company → `404`

---

## 6. Error reference

| Status | Cause |
|---|---|
| `401` | Missing/invalid/revoked API token, or company header mismatch |
| `403` | Token lacks required payment scope |
| `404` | Feature flag off, unknown `deal_id` on upsert, or unknown `paymentId` on show |
| `422` | Validation failed (missing fields, bad currency, bad status, proof download failure, etc.) |
| `500` | Unexpected server error (`reference_id` included for support) |

Validation error body (typical):

```json
{
  "status": "fail",
  "message": "Validation failed.",
  "errors": {
    "amount": ["The amount field is required."],
    "currency": ["The selected currency is invalid for this company."]
  }
}
```

---

## 7. Integration notes for OL

1. **Always send `X-COMPANY-ID`** with the CRM company that owns the Deal.
2. **Always reuse the same `external_reference`** across the payment lifecycle (proof → approve/reject, or digital complete).
3. Prefer **`proof_url`** for system-to-system proof handoff (CRM downloads and stores). Use multipart `bill` only when convenient.
4. Set `gateway` to a stable provider key so CRM agents can distinguish website payments from manually entered ones.
5. Ensure the ISO `currency` exists on that company in CRM before calling (otherwise `422`).
6. Do **not** rely on session cookies; this path is token-only.
7. Confirm with CRM ops that feature flag **`sally.crm-write-client`** is enabled in the target environment.

### Suggested call sequence (manual bank transfer)

```text
1. Customer uploads proof on OL
2. OL POST /api/v2/payments  (status=proof_submitted, proof_url=…)
3. CRM agent reviews receipt on Payments UI
4. (Later) OL completion / decision hook POST again
   with same external_reference (status=approved|rejected)
```

Digital gateways can skip proof and POST once with `status=complete` (or `approved`) when settlement is confirmed.

---

## 8. Out of scope (this resource)

- Deal Redesign UI listing of payments (CRM Payments module is the review surface today)
- OL ← CRM approve/reject callback (separate ticket)
- User-permission / module seeding (token auth only; not end-user gated)
