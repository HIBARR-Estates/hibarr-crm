# CRM Email — dependencies and environments

Source these **before** E-09 (Mailtrap) and **before** E-38 (Zoho). Engineering can complete E-01–E-08 with the Fake adapter only.

## Feature flag

| Item | Detail |
|------|--------|
| Name | `crm.email` |
| Register | `config/features.php` `known_flags` so Inertia receives it |
| Remote | Same flags API as other CRM flags (`FeatureFlagService`). Ask flags owner to create it **off** in staging/production |
| Local | Do **not** add to `local_defaults` as true (would leak Email on every local box that misses the API) |
| Extra gate | `email_pilot_allowlist` in CRM — flag on + user listed |

## Mailtrap (first real adapter)

**Product:** Email Sandbox, not live Sending. Mail must never reach real customers.

| Item | Detail |
|------|--------|
| Account | One Mailtrap account is enough |
| Inboxes | **Two sandboxes** (Agent A, Agent B), each with its own SMTP user/pass and inbound address |
| Auth | API token (Bearer / `Api-Token`) stored in Infisical / env for the app; per-connection inbox id + SMTP secrets encrypted on `email_connections` |
| Host | `sandbox.smtp.mailtrap.io` (ports 25/465/587/2525) + Sandbox REST API |
| Dual-agent | One SMTP send to sandbox A does **not** appear in B. Inject the **same RFC Message-ID** into both inboxes to simulate R06 |
| Plus-addressing | **Not** a workaround for two agents |

### Env (indicative; exact keys in E-09)

- `MAILTRAP_API_TOKEN`
- Optional defaults: `MAILTRAP_ACCOUNT_ID`, `MAILTRAP_INBOX_ID_A`, `MAILTRAP_INBOX_ID_B` for local mapping — production-like setup still stores inbox ids **on the connection**

### What Mailtrap proves

Send, capture, fetch, HTML/attachments, connection stop/start, CRM matching if you control headers.

### What Mailtrap does not prove

Zoho OAuth, other-client Sent, folder rules, real DSN/bounce, UIDVALIDITY, org signatures, quotas. Those wait for [architecture.md](./architecture.md) Zoho adapter + spike (E-38–E-40).

Keep sandbox **out of production** adapter selection. Production is Zoho or nothing.

## Zoho Mail (CTO — not required to start E-01)

Existing `ZOHO_*` in `config/zoho.php` is calendar/CRM-style (`zohoapis.com`, global refresh token). **Do not reuse.**

Ask for:

- Dedicated Mail OAuth client (or extra Mail scopes), correct **data centre**
- Redirect URI on CRM HTTPS origin
- Scopes: read/send/folders/attachments (delegation/send-as if agents use aliases)
- Pilot mailboxes allowlisted in the Zoho org
- Written rate limits / send caps
- Whether Mail API, IMAP (`imappro`/`imap`), or both; XOAUTH2 vs app passwords
- Folder names for Sent/Archive/rule-moved; whether org injects a signature
- Push/webhooks vs poll

Secrets: **per-user** refresh tokens (encrypted column or Infisical pattern approved by security), not one org token.

## Secrets

Follow [infisical-ops-handoff.md](../infisical-ops-handoff.md). Mailtrap token and later Zoho client secret live in Infisical for deploy envs. Connection-level tokens stay in DB encrypted (same pattern as `SmtpSetting.mail_password`) unless security mandates a vault per mailbox.

Never log credentials. Ticket IMAP’s **plaintext** password pattern is forbidden here.

## File storage

Reuse `FILE_UPLOAD_BASE_URL` / `FILE_UPLOAD_API_KEY` with a **separate prefix** (e.g. `email-attachments/`). Not the lead/deal Files UI.

| Still needed from security/ops | When |
|--------------------------------|------|
| Max size / MIME policy | Before real customer files (E-21 can stub) |
| Malware product (none in-app today) | E-43; fail closed unless they sign otherwise |
| Short-lived signed downloads | With E-21/E-20 |

## HTML sanitizer

In-process library (e.g. HTML Purifier or equivalent already acceptable to security). No third-party “render HTML” service (mail would leave the CRM).

## Queues / workers

New queues `email-sync`, `email-send`. Ops must run workers for those names in staging when Mailtrap sync is on. Local: `php artisan queue:work --queue=email-sync,email-send,default` (or Horizon, if used in that env).

## Search / bounce / malware (later)

- MySQL is enough for pilot search if ACL is on every query (E-23).
- Bounce webhooks on Mailtrap **Sending** are not the sandbox; real bounce is a Zoho-spike item.
- ClamAV or gateway AV: E-43.

## Internal non-dependencies

Do **not** add as module dependencies: UNS/Plunk, `EmailDeliveryLog` (wrong semantics), Keycloak (login only), Zoho Calendar sync, `webklex/laravel-imap` ticket command.

## Environments

| Env | Adapter | Real PII mail |
|-----|---------|----------------|
| PHPUnit | Fake | No |
| Local | Fake and/or Mailtrap | No |
| Staging | Mailtrap; Zoho when spike ready | Only if privacy signed |
| Production | Zoho + flag + allowlist | Only after PRD gates |

## Sourcing checklist (ops)

- [ ] `crm.email` registered off in flags service
- [ ] Mailtrap account + two sandboxes + API token in Infisical (dev/staging)
- [ ] File prefix agreed
- [ ] Queue workers planned
- [ ] Zoho Mail OAuth client + DC + redirect URI (parallel, not blocking E-01)
- [ ] Privacy / file / successor policy owners named (block E-42–E-44)
