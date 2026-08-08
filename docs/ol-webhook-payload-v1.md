# CRM -> OL Webhook Contract (v1)

This document defines the webhook payloads the CRM will send to OL for lead/deal create and update events.

## Overview

- Direction: `CRM -> OL` (one-way)
- Trigger events:
  - `lead_created`
  - `lead_updated`
  - `deal_created`
  - `deal_updated`
- Delivery model: at-least-once (retries enabled)
- Idempotency: `eventId` in payload and `X-Idempotency-Key` header

## Endpoint

OL should provide a single HTTPS webhook endpoint URL for CRM to call.

Example:

- `POST https://<ol-domain>/api/webhooks/crm-events`

## Authentication

CRM authenticates via API key header.

- Header name: configurable, default is `X-API-KEY`
- Header value: shared API key provided by OL

## Request Headers

Every webhook request includes:

- `Content-Type: application/json`
- `<API_KEY_HEADER>: <API_KEY_VALUE>` (for example `X-API-KEY: abc123`)
- `X-Idempotency-Key: <eventId>`

## Base Payload (all events)

```json
{
  "eventId": "11111111-1111-1111-1111-111111111111",
  "eventType": "lead_created",
  "entityType": "lead",
  "crmId": 123,
  "correlationId": "22222222-2222-2222-2222-222222222222",
  "occurredAt": "2026-07-07T09:00:00+00:00",
  "entityData": {}
}
```

Field definitions:

- `eventId` (string, UUID): unique webhook event identifier
- `eventType` (string): one of `lead_created`, `lead_updated`, `deal_created`, `deal_updated`
- `entityType` (string): `lead` or `deal`
- `crmId` (integer): CRM record ID for the lead/deal
- `correlationId` (string|null, UUID): correlation ID for related event chain
- `occurredAt` (string, ISO-8601 datetime): event timestamp in CRM
- `entityData` (object): entity-specific fields for lead/deal (see below)

## Lead Payload (v1)

Lead events include lead-specific fields inside `entityData`:

- `firstName` (string)
- `lastName` (string)
- `email` (string|null)
- `phone` (string|null)
- `status` (string|number|null)
- `assignedTo` (object|null)
  - `id` (integer)
  - `name` (string)
- `category` (object|null)
  - `id` (integer)
  - `name` (string)

Example:

```json
{
  "eventId": "11111111-1111-1111-1111-111111111111",
  "eventType": "lead_updated",
  "entityType": "lead",
  "crmId": 123,
  "correlationId": "22222222-2222-2222-2222-222222222222",
  "occurredAt": "2026-07-07T09:10:00+00:00",
  "entityData": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "+447000000000",
    "status": "qualified",
    "assignedTo": {
      "id": 45,
      "name": "Agent Smith"
    },
    "category": {
      "id": 3,
      "name": "Hot"
    }
  }
}
```

## Deal Payload (v1)

Deal events include deal-specific fields inside `entityData`:

- `title` (string)
- `value` (number|null)
- `stage` (string|number|null)
- `status` (string|number|null)
- `assignedTo` (object|null)
  - `id` (integer)
  - `name` (string)

Example:

```json
{
  "eventId": "33333333-3333-3333-3333-333333333333",
  "eventType": "deal_created",
  "entityType": "deal",
  "crmId": 987,
  "correlationId": "44444444-4444-4444-4444-444444444444",
  "occurredAt": "2026-07-07T09:20:00+00:00",
  "entityData": {
    "title": "Downtown Penthouse Deal",
    "value": 1500000,
    "stage": "Negotiation",
    "status": "won",
    "assignedTo": {
      "id": 61,
      "name": "Agent Johnson"
    }
  }
}
```

## Delivery and Retry Behavior

- CRM considers any HTTP `2xx` response as success.
- CRM retries transient failures (for example timeout, `408`, `429`, `5xx`) with backoff.
- CRM may deliver the same event more than once during retry scenarios.
- OL should treat `eventId`/`X-Idempotency-Key` as idempotency keys.

## OL Response Expectations

For successful processing, OL should return:

- HTTP `200` or `204` (recommended)

For temporary issues where retry is desired, OL may return:

- HTTP `429` or `5xx`

