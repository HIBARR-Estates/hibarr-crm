# Internal Agent Level Assignment API

System-to-system endpoint for programmatic agent commission level assignment (OL bulk promotion orchestration).

## Endpoint

`PATCH /api/v1/internal/agents/{agentId}/level`

## Authentication

Use the same pattern as other CRM internal APIs:

| Header | Required | Description |
|--------|----------|-------------|
| `X-API-TOKEN` | Yes | API token from `api_tokens` table (or `Authorization: Bearer <token>`) |
| `X-COMPANY-ID` | Yes | Company context for the request |

Missing or invalid/revoked tokens return **401** with `{ "message": "..." }`.

## Request

```json
{ "levelId": 123 }
```

`level_id` is also accepted for backward compatibility.

## Success (200)

```json
{
  "status": "success",
  "message": "Agent level updated successfully.",
  "data": {
    "agentId": 1,
    "levelId": 123,
    "levelName": "Silver",
    "assignedAt": "2026-06-18T12:00:00+00:00"
  }
}
```

## Error responses

| Status | `error` code | When |
|--------|--------------|------|
| 401 | — | Missing or invalid `X-API-TOKEN` |
| 404 | `AGENT_NOT_FOUND` | Agent does not exist for company |
| 404 | `LEVEL_NOT_FOUND` | Level does not exist for company |
| 422 | `LEVEL_HIDDEN` | Level has `is_hidden = true` |

```json
{ "error": "LEVEL_NOT_FOUND", "message": "Commission level not found." }
```

## Behavior notes

- Direct assignment only — does **not** run auto-evaluation qualification checks.
- On promotion (higher rank), `custom_direct_rate` and `custom_override_rate` are cleared when `FEATURE_SALES_PER_AGENT_COMMISSION_OVERRIDE` is enabled (HIB-854).
- Future deal-won events may still trigger normal auto-promotion for higher visible levels.
- Feature flag `FEATURE_SALES_BULK_AGENT_PROMOTION` gates OL orchestration; the CRM endpoint remains callable regardless of flag state.
