# OL handoff: Keycloak identity for CRM partner invitations

**Audience:** hibarr-backend / OL (Toyin and platform)
**From:** CRM (Isaac)
**Related CRM work:** [hibarr-crm PR #1324](https://github.com/HIBARR-Estates/hibarr-crm/pull/1324) — Invite Partner shipped; Keycloak enrolment left open ([CodeRabbit thread](https://github.com/HIBARR-Estates/hibarr-crm/pull/1324#discussion_r4237090836))

CRM will call OL for Keycloak work. Please implement the HTTP API below (wrapping existing `oidcService` helpers). CRM will wire against this contract and will not talk to Keycloak Admin API itself.

---

## 1. Background

### What CRM already does

Admins can **Invite Partner** on the Partners page. That flow:

1. Creates a local CRM user (`employee` + `partner`) and a partner `LeadAgent`.
2. Sends a `PartnerInvited` email.
3. Expects the partner to sign in with **Keycloak SSO only** (local password is random and never shared).

### The gap

CRM never creates or verifies a Keycloak identity. On first SSO login, CRM will only link an unseen Keycloak identity to a CRM user by email if Keycloak asserts `email_verified`. An invited partner whose email has **no verified Keycloak account cannot sign in**.

Self-registration in the realm was considered and **rejected** for this feature. The agreed path is **provision**: OL creates or finds the Keycloak user and triggers enrolment (set-password email).

### Why OL owns this

- hibarr-backend already has Keycloak Admin usage (`oidcService.createKeycloakUser`, `sendKeycloakPasswordSetupEmail`, service-account admin token, agent-provisioning worker).
- CRM is expected to be deprecated longer-term; duplicating a Keycloak admin client in Laravel would repeat work and split identity ownership.
- CRM already calls OL with API key for other concerns (e.g. telephony, payments); this should follow the same pattern.

### Desired end-to-end outcome

1. Admin invites a partner in CRM.
2. CRM creates the local partner account, then calls OL to **provision** Keycloak.
3. Partner receives Keycloak’s enrolment email, sets a password, and signs into CRM on the **first** attempt.
4. CRM stores the Keycloak user id locally (`socials`) so login resolves by identity, not only by email + `email_verified`.
5. **Resend** from CRM re-triggers Keycloak’s actions email via OL.
6. Partner remove / CRM deactivate asks OL to **disable** the Keycloak user (no orphans).
7. Provision is **idempotent** (retry must not create duplicate Keycloak users).

CRM will also send its own short “you’re a partner” notification; OL/Keycloak owns the password-setup email. Exact mail split can be refined — avoid two conflicting “sign in now” CTAs if possible.

---

## 2. What we need from OL

Expose a small **internal, API-key-authenticated** Keycloak identity API that CRM can call. Prefer reusing existing OIDC admin helpers; do not require CRM to hold realm-management secrets.

### Auth and mounting

| Item | Expectation |
|------|-------------|
| Auth | API key (`X-Api-Key`), same as other CRM → OL calls |
| Suggested prefix | `/v1/internal/keycloak/...` (or `/v1/internal/identity/...` if that fits better) |
| Secrets | Reuse OL’s existing Keycloak service-account client; never return or log client secrets |
| Network | API (and any worker used) must reach Keycloak Admin API as today |

**Not suitable as-is:**

- `POST /v1/users/password-reset` — requires an **OL user id**; CRM partners are not OL users.
- `/v1/agents/invitations/*` — different product flow (agent registration).

---

## 3. Endpoints

### A. Provision — create or find + optional setup email

`POST /v1/internal/keycloak/users`

**Request**

```json
{
  "email": "partner@example.com",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "sendSetupEmail": true
}
```

**Behaviour**

- Normalize email (trim, lower-case).
- Find Keycloak user by email; if missing, create (`enabled: true`).
- If `sendSetupEmail`: Keycloak `execute-actions-email` (at least `UPDATE_PASSWORD`; see open questions for `VERIFY_EMAIL` / `emailVerified`).
- **Idempotent:** existing user → update profile as needed, return the same id with `created: false`; still send setup email when requested.

**Response `200`**

```json
{
  "keycloakUserId": "uuid-or-keycloak-id",
  "created": true
}
```

**Errors:** `400` validation; `502`/`503` when Keycloak is unavailable; stable machine-readable `code` + safe `message` (no secrets).

CRM calls this on **Invite** (and on Resend when no Keycloak id is stored yet).

---

### B. Resend actions email

`POST /v1/internal/keycloak/users/{keycloakUserId}/actions-email`

**Request**

```json
{
  "actions": ["UPDATE_PASSWORD"]
}
```

Optional: also accept `{ "email": "..." }` when CRM only has the address (backfill / failed invite). Prefer id when known.

**Behaviour:** Keycloak `execute-actions-email` for that user.
**Response:** `204` or `200` ack.
**Errors:** `404` unknown user; Keycloak/SMTP failures as `502` with a safe message.

CRM calls this on **Resend invite**.

---

### C. Lifecycle update

`PATCH /v1/internal/keycloak/users/{keycloakUserId}`

**Request examples**

```json
{ "enabled": false }
```

```json
{
  "email": "new@example.com",
  "firstName": "Ada",
  "lastName": "Lovelace"
}
```

**Behaviour:** Patch the Keycloak user. Support at least `enabled`, `email`, `firstName`, `lastName`.
**Response:** `200` with `{ "keycloakUserId" }` or `204`.
**Errors:** `404`; email clash `409`.

CRM calls this when a partner is removed or a CRM user is deactivated (and later for email changes).

---

### D. Optional lookup

`GET /v1/internal/keycloak/users?email=partner@example.com`

**Response `200`:** `{ "keycloakUserId": "..." }` — or `404`.

Useful for backfill and support; provision can stay idempotent without it.

---

## 4. Mapping to existing OL code

| Endpoint | Likely reuse |
|----------|----------------|
| Provision | `oidcService.createKeycloakUser` + `sendKeycloakPasswordSetupEmail` |
| Actions email | `sendKeycloakPasswordSetupEmail` / `execute-actions-email` |
| Patch | `updateKeycloakUserById` + enable/disable via Admin API (add `enabled` if missing today) |

Reference patterns: `src/services/auth/oidc.service.ts`, `src/workers/agent-provisioning.worker.ts`.

**Known deltas vs current helpers (please confirm in implementation):**

- Create may not set `emailVerified: true` today.
- Setup email today uses `UPDATE_PASSWORD` only (not `VERIFY_EMAIL`).
- Product should confirm verified-at-create vs verify-via-email (open questions below).

---

## 5. Open questions

1. Set **`emailVerified: true` at create**, send **`VERIFY_EMAIL`**, or both?
2. On partner remove: **disable** vs **delete** the Keycloak user? (CRM recommendation: **disable**.)
3. Exact path prefix and error envelope to match other `/v1/internal/*` routes.
4. Confirm CRM SSO client and OL admin client target the **same Keycloak realm** partners will use.
5. Grant the CRM application API key access to these routes.

---

## 6. Acceptance for OL

- [ ] Provision, actions-email, and patch shipped (lookup optional)
- [ ] API-key auth; CRM key allowed
- [ ] Provision idempotent (same email → same `keycloakUserId`, `created: false` on second call)
- [ ] Tests: create, already-exists, Keycloak failure, resend
- [ ] Logs/audit without secrets
- [ ] `docs/CODEBASE_BRIEF.md` updated if routes/conventions change
- [ ] Final paths + example request/response shared back to CRM so Http client config can be filled in

---

## 7. How CRM will consume this (for context only)

CRM will:

1. Add a `KeycloakIdentityClient` contract and HTTP adapter pointing at these routes (`services.ol` base URL + API key).
2. Gate the new invite behaviour behind a feature flag (`crm.partner-keycloak-provision`).
3. On invite: create local user → call **provision** → store `Social` (`keycloak` + `keycloakUserId`) → send CRM notification.
4. On resend: call **actions-email** (or provision again if no id yet).
5. On destroy/deactivate: best-effort **patch** `enabled: false`.

No CRM-side Keycloak admin credentials. Once OL shares final paths, CRM flips config and enables the flag on staging for E2E (invite → enrol → first login).

---

*Please implement §3 and reply with final paths, auth notes, and any deltas from the open questions. CRM work proceeds against this contract in parallel.*
