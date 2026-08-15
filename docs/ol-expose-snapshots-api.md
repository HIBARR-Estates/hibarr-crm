# OL Integration Guide — Expose Snapshot Reference API

Audience: engineers on **hibarr-backend / OL** (and CRM consumers) who need a **frozen exposé payload** tied to a specific agent + lead, with a convenient reference token for cache/audit — **not** a new auth mechanism.

Companion docs:
- Live presentation DTO: [ol-expose-presentation-api.md](./ol-expose-presentation-api.md)
- Catalog discovery: [ol-developer-projects-api-integration.md](./ol-developer-projects-api-integration.md)

---

## 1. Auth vs snapshot reference

| Concern | Mechanism |
|---|---|
| **Authorization** | Existing `api.token` only (`X-API-TOKEN` or Bearer + `X-COMPANY-ID`) |
| **Snapshot `token`** | Opaque **lookup / cache key** (`exp_…`). Knowing it without a valid company API token grants **nothing**. |

All routes below are behind `api.token`.

### Scopes

```text
api.expose-snapshots.create
api.expose-snapshots.show
api.expose-snapshots.index
```

---

## 2. Endpoints

| Method | Path | Scope | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/expose-snapshots` | `api.expose-snapshots.create` | Mint snapshot: freeze DTO now; return token + full expose |
| `GET` | `/api/v1/expose-snapshots/{token}` | `api.expose-snapshots.show` | Load frozen payload by reference |
| `GET` | `/api/v1/expose-snapshots` | `api.expose-snapshots.index` | List/audit (filter by lead/agent/entity) |

There is **no TTL** — snapshots do not expire. Re-minting with the same payload always creates a **new** row (new token + new freeze = audit trail).

---

## 3. Mint — `POST /api/v1/expose-snapshots`

### Required body

| Field | Type | Notes |
|---|---|---|
| `entity_type` | string | `property` \| `developer_project` \| `unit_type` |
| `entity_id` | int | Property id, or project id (for project / unit_type) |
| `agent_id` | int | Company user generating the exposé (**required**) |
| `lead_id` | int | Lead the exposé is for (**required**) |
| `unit_type_id` | int | **Required** when `entity_type=unit_type` |
| `layout` | string | Optional; defaults per entity type |

### Example

```bash
curl -sS -X POST \
  -H "X-API-TOKEN: ${CRM_EXPOSE_TOKEN}" \
  -H "X-COMPANY-ID: ${COMPANY_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "unit_type",
    "entity_id": 42,
    "unit_type_id": 501,
    "agent_id": 12,
    "lead_id": 99,
    "layout": "expose-template"
  }' \
  "${CRM_BASE_URL}/api/v1/expose-snapshots"
```

### Success `201`

```json
{
  "status": "success",
  "data": {
    "snapshot_id": 1001,
    "token": "exp_ab12cd34…",
    "token_prefix": "exp_ab12cd34",
    "created_at": "2026-08-06T14:00:00.000000Z",
    "entity_type": "unit_type",
    "entity_id": 42,
    "unit_type_id": 501,
    "agent_id": 12,
    "agent": {
      "id": 12,
      "name": "Jane Agent",
      "email": "jane@hibarr.de",
      "phone": "+49…",
      "position": "Sales Consultant",
      "image": null
    },
    "lead_id": 99,
    "lead": {
      "id": 99,
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "phone": null,
      "company_name": null
    },
    "layout": "expose-template",
    "schema_version": 1,
    "expose": { /* full ExposePresentationDto — see ol-expose-presentation-api.md */ },
    "warnings": []
  }
}
```

Notes:
- `expose.agent` / `expose.client` are frozen to the same agent/lead names used in `agent` / `lead`.
- Plain `token` is returned on mint (and echoed on GET by path). List returns `token_prefix` only (full token is not re-derivable from storage).
- Client should cache `{ token → expose }` locally after mint.

### Validation `422`

Missing/invalid `agent_id`, `lead_id`, entity, or `unit_type_id`:

```json
{
  "status": "fail",
  "message": "Validation failed",
  "errors": {
    "lead_id": ["Lead not found for this company."]
  }
}
```

---

## 4. Show — `GET /api/v1/expose-snapshots/{token}`

Returns the **same `data` shape** as mint (including full `expose`), using the frozen JSON — does **not** rebuild from live property/project data.

Unknown / other-company token → `404`.

---

## 5. List — `GET /api/v1/expose-snapshots`

### Query

| Param | Notes |
|---|---|
| `lead_id` | Filter |
| `agent_id` | Filter |
| `entity_type` / `entity_id` / `unit_type_id` | Filter |
| `page` / `per_page` | Pagination |
| `include=expose` | Include full frozen `expose` (+ `warnings`) per row |

### Default row (summary)

Includes `agent` and `lead` **objects with names**, plus `token_prefix` (not full token).

Paginated envelope matches catalog list style (`status`, `data`, `current_page`, `total`, …).

---

## 6. Errors

| Status | When |
|---|---|
| `401` | Missing/invalid API token |
| `403` | API token lacks scope |
| `400` | Missing `X-COMPANY-ID` (defensive) |
| `404` | Snapshot not found for this company |
| `422` | Mint validation (agent/lead/entity) |
| `500` | Unexpected; includes `reference_id` |

---

## 7. Recommended OL flow

1. Discover entity via catalog list/show.
2. `POST /expose-snapshots` with `agent_id` + `lead_id` → cache `token` + `expose`.
3. Later reload: `GET /expose-snapshots/{token}` with API token (or use local cache).
4. History / audit: `GET /expose-snapshots?lead_id=` or `?agent_id=`.
5. Fresh content or new generation event: mint again → new token.

---

## 7.1 CRM share links (agents)

When feature flag **`crm.expose-share-links`** is enabled, CRM agents mint the same `exp_…` snapshots from the session UI (`POST /account/expose-snapshots/share`). The response includes:

| Field | Notes |
|---|---|
| `token` | Same opaque `exp_…` reference as API mint |
| `share_url` | `{EXPOSE_SHARE_BASE_URL}/{token}` (default base: `https://hibarr-os-expose.vercel.app`) |
| `snapshot_id` | Row id |
| `warnings` | Same content warnings as API mint |

Agents share `share_url` with leads. The exposé host app loads `/{token}`, calls OL, and OL resolves via existing **`GET /api/v1/expose-snapshots/{token}`** (API token + `X-COMPANY-ID`). No public CRM resolve endpoint — auth vs snapshot reference (§1) is unchanged.

---

## 8. Checklist

- [ ] Token includes create/show/index snapshot scopes
- [ ] Never treats `exp_…` as authorization
- [ ] Always sends `agent_id` + `lead_id` on mint
- [ ] Uses nested `agent.name` / `lead.name` (not ids alone) in UI
- [ ] Caches mint `token` for later GET
- [ ] Handles `422` / `404` / `401` / `403` distinctly
