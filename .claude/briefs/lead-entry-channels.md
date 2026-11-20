# Lead Entry Channels (registry, in-flight identification, CRM routing)
**Date:** 2026-11-20
**Scope:** hibarr-backend (registry, resolution, entry log, APIs) + hibarr-crm (entry intake, automation trigger/conditions, owner-assignment action, management UI)
**Status:** Design brief (not implemented)

---

## Goal

Every time a lead comes in through a form (webinar registration, consultation booking, lead-magnet download, landing-page / ad form, package interest), the system records **which entry channel** it came through. The CRM's automations then use that channel to decide **who owns the lead**.

The channel catalog, how a submission is matched to a channel, and the per-submission entry log all live on the **backend**. The CRM reads and manages them through backend APIs. **Assignment** is a CRM automation (`DealAutomation`, subject `lead`).

## Scope: built now vs. acknowledged for later

| | Channels | Status |
|---|---|---|
| **Built now** | All `form` types (webinar registration, consultation booking, lead magnet, landing-page / ad form, package interest, masterclass, property enquiry, Facebook group, signup) and `partner_referral` | Phases 0–6 |
| **Acknowledged, not built** | Email to a shared inbox (info@), WhatsApp to the company number, Instagram DM / comment, inbound call. Also CRM-created leads (`crm_manual`, `crm_import`) | Not available yet. Designed in §11 so they slot in later without reworking the model |

These later channels differ from forms in three ways: they are picked up by the **CRM**, not the backend; they are **conversations**, so not every message is an entry; and they may only identify the lead by a handle or phone number. §11 describes how each of these is handled.

**What v1 does so they fit later, and nothing more:**
- The type registry has `family`, `entryPolicy` and `origin` fields. Every v1 type is `form`/`referral`, `every_submission`, `backend`, but the fields exist, so a new family is a registry entry rather than a schema change.
- The resolver takes the type from its caller and contains no endpoint-specific code, so a CRM caller later is just another caller.
- `lead_entries.origin` exists (always `backend` in v1), so history never has to be backfilled with a guessed origin.
- Bindings use `entityId` **or** a normalized `entityKey`, so an inbox address, phone number or Instagram id can be bound later without a migration (only new values in the registry's allowed entity types).
- The CRM trigger, scope and conditions work on channel uuids and types, so they don't care which family an entry belongs to.

Nothing else for the later channels is built in v1: no report-entry endpoint, no interaction columns, no conversation window, no `interaction_handler` strategy, no changes to the CRM's message, email or call intakes.

## TL;DR

| Piece | Already exists? | Where | New work? |
|---|---|---|---|
| Per-endpoint lead creation + dedup | Yes | backend `leadEntryService` (flag `sales.unified-lead-entry`) | Add one `recordEntry()` step |
| Event log per registration | Yes | backend `events` (`EventName.WEBINAR_REGISTRATION`, `LEAD_CAPTURE`, `PACKAGE`, …) | Use for backfill only |
| First-touch / touch sequence | Yes | backend `lead_first_touch`, `lead_touch_sequence.channel`, `attribution_channel_credit.channel` | **Do not reuse.** That "channel" means marketing attribution, a different concept |
| CRM lead source from UTMs / formKey | Yes | backend `utm_configs.leadSourceId`, `crm_lookup_entries(kind=lead_source)`; CRM `lead_sources` | Keep as is. Channels are a separate dimension (see §1) |
| CRM reading backend config over API key | Yes | CRM `OlUtmConfigService` → backend `GET /v1/internal/utm-configs` | Copy this pattern for channels |
| Lead automations with API triggers + scope | Yes | CRM `DealAutomationService::processLead($lead, $trigger, $context)`, `matchesTriggerScope` (`meeting_type_ids`), `TRIGGER_LEAD_CREATED_API` | New trigger + channel scope |
| Owner assignment action | **No** | `set_field_value` can set one fixed `lead_owner`; the only round-robin is deal-agent assignment by category in `DealObserver::creating` | **New** `assign_lead_owner` action + pools |
| Channel registry, bindings, entry log | **No** | none | **New** (backend) |
| Backend leaves owner unset | **No** | `lead-crm-sync.service.ts` always sends `lead_owner_id` (falls back to `CRM_SYNC_DEFAULTS.LEAD_OWNER_ID = 1`) | **Must change**, or every lead arrives already owned by user 1 |

---

## 1. Concepts (settle these names first)

Three things that are easy to mix up:

| Concept | Answers | Owner | Example |
|---|---|---|---|
| **Entry channel** (new) | *What did the lead fill in / sign up for?* The conversion point | backend | `Webinar › DE › Investing 101`, `Consultation › Kickoff call`, `Lead magnet › Northern Cyprus guide` |
| **Lead source** (exists) | *Where did the traffic come from?* | CRM `lead_sources`, mapped from UTMs/formKey on the backend | `Meta`, `Google`, `Website` |
| **Attribution channel** (exists) | Marketing credit model | backend `lead_touch_sequence` / `attribution_channel_credit` | `paid_social`, `organic` |

Rules:
- **A channel is never derived from UTMs.** The same Meta ad can lead to a webinar or to a consultation, and the same webinar is reached from many ads. Automations combine the two when needed (`channel under Consultation` **and** `utm_source = meta`).
- Use the full name **"entry channel"** in code, tables, routes and UI copy (`entry_channels`, `lead_entries`, `entry_channel_uuid`). A bare `channel` already means attribution in this codebase.

### Entry context: partner, agent, campaign
Routing often depends on *who or what brought the lead*, not only on what they filled in: "leads from the spring Meta campaign go to the DE team", "leads from partner X go to that partner's manager". These are recorded as **entry context**, a second dimension next to the channel. They are **not** channels or bindings:

- One campaign or partner drives many forms of different types (a webinar *and* a consultation). A channel tree is per type, and a binding maps one object to one channel, so a campaign can't be a binding without forcing a choice between "the webinar's channel" and "the campaign's channel" for the same entry. As context, both are kept.
- Context reuses existing records (agents, attribution links, UTM configs). The only new data is one partner flag and two link columns.

#### Partner and agent: both come from `agt`
A partner can bring a lead two ways, and both identify the partner through an agent:
- **Through our forms**, via a link carrying `agt` (the agent id). `utmInfo.agt` already reaches every registration endpoint, and attribution links already add `agt` to their URLs (`attribution-links.service.ts`).
- **Through the partner API** (`leadGenerationService.ingestContact/ingestDeal`), authenticated as an `applications` row. New nullable `applications.partnerAgentId` maps the application to its partner agent, so both ways resolve to the same identity. (The push itself is also the channel: type `partner_referral`, binding kind `partner_application`.)

Two context values come out of that:

| Value | Meaning | Resolved how |
|---|---|---|
| `referral_agent` | the exact agent on the link / application | `agt` (or `applications.partnerAgentId`), checked with the existing `resolveEligibleAgentFromAgt` |
| `partner` | the partner that agent belongs to | the nearest agent at or above `referral_agent` in the `parentId` chain flagged as a partner. **The backend has no partner flag today** (the CRM has `lead_agents.is_partner`), so add `agents.isPartner`, kept in sync with the CRM flag. No partner-flagged agent in the chain → `partner` is null (a house agent) |

#### Campaign: identified by our link id, or scoped to the partner
A bare `utm_campaign` string is not a safe identity: a partner can use `spring_sale` for their own campaign while we, or another partner, use the same value. So a campaign is resolved in this order, and a partner's traffic is **never** matched against HIBARR's own campaign list:

1. **`utm_id` = a link we issued.** Attribution links start adding `utm_id=<link uuid>` (a standard UTM parameter) next to the UTMs and `agt` they already add. A match gives the exact link, and through it the configured campaign, the agent and the folder. Nobody else's campaign can produce one of our link uuids, so this can't clash. Needs: `utmId` in `registrationUtmInfoSchema`, and the website forwarding it like the other UTMs.
2. **Exact match on an issued link's UTM set + `agt`.** For links created before `utm_id` existed: same source, medium, campaign and `agt` as exactly one `attribution_links` row.
3. **Partner-scoped.** `partner` is set but nothing above matched: the campaign key is `partner:<partnerAgentId>:<utm_campaign>`. It is only ever compared with that partner's own campaigns.
4. **House campaign.** No partner: match `utm_campaign` against `utm_configs` with `type = campaign` (normalized like `UtmLeadSourceResolverService`). Key `house:<value>`.
5. **Unknown.** Kept raw, never rejected, listed as "unconfigured campaigns" for marketing.

The entry stores the campaign key, how it matched (`utm_id`, `link_tuple`, `partner_scoped`, `house_config`, `raw`), the attribution link id and UTM config id where known, and the raw UTMs.

| Context column on `lead_entries` | Source |
|---|---|
| `contextReferralAgentId` | `agt` / application's partner agent |
| `contextPartnerAgentId` | nearest partner-flagged agent at or above it |
| `contextCampaignKey` | `house:<value>` or `partner:<agentId>:<value>`; null if no campaign |
| `contextCampaignMatchedBy` | one of the five steps above |
| `contextAttributionLinkId`, `contextCampaignUtmConfigId` | when steps 1, 2 or 4 matched |

- Dimensions live in a small code registry (`ENTRY_CONTEXT_DIMENSIONS`: key, how to read it from a request, how to resolve it, CRM picker source), so adding one later (e.g. Meta `ad` ids once Meta lead-ads ingestion exists) is a registry entry plus a nullable column or a `context` jsonb key.
- Context resolution never fails a request.

### Taxonomy: type → tree → bindings

```
EntryChannelType (code registry, closed set; adding one needs code)
  └─ root channel (system row, one per type, also the type's catch-all)
       └─ channel (admin-managed, nestable up to 3 levels below the root)
            └─ binding(s): concrete objects (webinar, event type, lead magnet, landing page, package key; later mailbox, WhatsApp number, Instagram account/post, phone line)
```

- **Type** says *which code path* produced the entry. It lives in code (`ENTRY_CHANNEL_TYPES` registry: key, label, **family**, **entry policy**, **origin system**, allowed binding entity types, emitting code paths), because a new type only makes sense when a handler emits it. Each type also gets a seeded **root channel row**, so the tree has one shape and every type has a catch-all.

  | Family | Types | Origin (where it's ingested) | Entry policy | Status |
  |---|---|---|---|---|
  | `form` | `webinar_registration`, `consultation_booking`, `lead_magnet`, `ad_form` (landing page / lead capture), `package_interest`, `masterclass_registration`, `property_enquiry`, `community_join` (Facebook group), `signup`, later `meta_lead_form` | backend | `every_submission` | **now** |
  | `conversation` | `inbound_email` (shared inbox, e.g. info@), `whatsapp_message` (company number), `instagram_dm`, `instagram_comment` | CRM (Email module review queue; `CommunicationActivity` intake) | `conversation_window` | future (§11) |
  | `call` | `inbound_call` | CRM / CallBridge (`LeadPhoneMatcher`, CRM-pushed call events) | `conversation_window` | future (§11) |
  | `referral` | `partner_referral` | backend | `every_submission` | **now** |
  | `internal` | `crm_manual`, `crm_import` | CRM | `every_submission` (only if the creator opts in) | future (§11) |

  - **Family** is a fixed grouping above types. It lets an automation say "any conversation channel" without listing types, and it groups the settings UI. A channel tree can't span two types, so the family is how routing goes across types.
  - Future types are listed so the taxonomy is settled now, but their registry entries and root channels are only added when their intake exists (§11).
  - **Entry policy** decides which inbound events count as an *entry*. Only `every_submission` is implemented in v1.
- **Channels** are the routing units. Admins create and nest them (sub-categories), for example `Webinar › DE` and `Webinar › DE › Investing 101`. Depth is capped at **3 below the root**. More depth makes automations harder to reason about.
- **Tags** (`market:de`, `language:de`, `product:villa`) cover dimensions that cut across the tree, so the tree never has to encode every dimension. A channel inherits its ancestors' tags. Automations can match on a tag.
- **Bindings** map one concrete object to one channel. **Each object has at most one binding** (unique on entity), so resolution is deterministic. Many objects can share one channel; that's the point.

### Why not per-object channels (one channel per webinar)?
Routing groups many objects together (all German webinars go to the DE team). If every new webinar or landing page created its own channel, the catalog would grow without bound and every new object would need a new automation. Instead, unbound objects fall into their type's catch-all, and an **"unbound sources" report** (Phase 5) lists objects producing catch-all entries so admins can bind them.

---

## 2. Backend data model

All tables follow the repo's conventions: integer `id` + UUIDv7 `uuid`, models registered in `model-registry.ts`, and migrations compiled before `db:migrate` (CODEBASE_BRIEF §12).

### `entry_channels`
| Column | Type | Notes |
|---|---|---|
| `id`, `uuid` | int / uuid v7 | Automations and the CRM reference **`uuid`**, never `id` |
| `key` | varchar(100), unique | `^[a-z0-9_]+$`, **immutable** after create. Human/debug handle and the client-declared identifier |
| `name`, `description` | varchar / text | Editable. Renaming never breaks anything |
| `type` | varchar(48) | One of `ENTRY_CHANNEL_TYPES`. Inherited from the root, immutable |
| `parentId` | int FK self, null only for system roots | Re-parenting is allowed, but only within the same type |
| `path` | varchar(512) | Materialized key path `webinar_registration/webinar_de/webinar_de_investing`. Rebuilt for the subtree on re-parent (in one transaction) |
| `depth` | smallint | 0 = root. Max 3 |
| `isSystem` | bool | Roots: cannot be renamed, archived or re-parented |
| `status` | varchar(16) | `active` \| `archived`. **No hard delete once any `lead_entries` row references it** |
| `tags` | jsonb string[] | GIN index |
| `crmLeadSourceId` | int null | Optional. Phase 5 consolidation with `crm_lookup_entries` formKey rows |
| `sortOrder`, `metadata` jsonb, `createdBy`/`updatedBy` (actor ref string), timestamps | | |

### `entry_channel_bindings`
| Column | Notes |
|---|---|
| `id`, `uuid`, `channelId` FK | |
| `entityType` | varchar(32), validated against the type registry's allowed list: `webinar`, `webinar_session`, `event_type`, `lead_magnet`, `form`, `landing_page`, `package`, `masterclass`, `website_form` (formKey), `crm_meeting_type` (CRM meeting type id), `crm_package` (CRM package id). Later: `mailbox`, `whatsapp_number`, `instagram_account`, `instagram_media`, `phone_line` (§11) |
| `entityId` int null / `entityKey` varchar(191) null | CHECK exactly one. Ids for our own rows. Keys for externally owned identifiers (formKey; later inbox addresses, phone numbers, Instagram ids). Keys are normalized before storing and lookup |
| unique | partial unique `(entityType, entityId)` and `(entityType, entityKey)`: **one channel per object** |

**Binding entity types** are a new code enum (`EntryBindingEntityType`, backend `src/infrastructure/enums/entry-channel.enum.ts`, Phase 1). Each type in `ENTRY_CHANNEL_TYPES` lists which of them it accepts. Each value names what the binding's id or key points at:

| Value | Points at | Stored as | Who owns the record | Picker source / validation |
|---|---|---|---|---|
| `webinar`, `webinar_session`, `event_type`, `lead_magnet`, `form`, `landing_page`, `masterclass` | backend tables of the same name | `entityId` | backend | backend `GET …/entry-channels/bindable`; FK-checked on save |
| `crm_package` | a CRM package. The backend keeps a synced copy in `crm_packages` (`crm-package.model.ts`, `crmPackageId`) | `entityId` = CRM package id (the `packageId` the package registration already sends) | CRM | listed and checked against `crm_packages` |
| `crm_meeting_type` | a CRM `MeetingType` (`app/Models/MeetingType.php`). The consultation request sends it as `meetingDetails.meetingTypeId` | `entityId` = CRM meeting type id | CRM | the CRM settings UI lists its own meeting types; the backend has no copy, so it can't check the id exists |
| `partner_application` | the API application a partner uses to push leads (`applications`, `application.model.ts`; gains `partnerAgentId`). Only for type `partner_referral` | `entityId` = application id | backend | listed from `applications`; FK-checked |
| `website_form` | a website form's `formKey`. **There is no table of forms**: it's a free string the website sends (`lookupKeyField`: lower-case, `^[a-z0-9][a-z0-9_-]*$`, max 100). Today it only appears as a key in `crm_lookup_entries` (`kind = lead_source`) | `entityKey` | the website | typed by the admin, validated with the same pattern; the picker suggests keys already in `crm_lookup_entries` and keys seen on recent entries |

### `lead_entries` (the per-submission log, the source of truth for "how did this lead come in, every time")
| Column | Notes |
|---|---|
| `id`, `uuid` | The `uuid` is the idempotency key the CRM dedupes on |
| `leadId` FK leads (CASCADE), not null in v1 | Becomes nullable when CRM-originated entries arrive (§11) |
| `origin` | `backend` \| `crm`. Always `backend` in v1 |
| `channelId` FK | |
| Snapshot: `channelType`, `channelPath`, `channelAncestorUuids` jsonb, `channelTags` jsonb | Frozen at entry time, so history stays true after re-parenting or archiving |
| `sourceEntityType`, `sourceEntityId`, `sourceEntityKey`, `sourceLabel` | The concrete object submitted to |
| `resolvedBy` | `binding` \| `declared` \| `rule` \| `type_default` (debugging and the unbound report) |
| `isNewLead` | Whether this entry created the lead |
| `occurredAt`, `utm` jsonb, `formKey`, `language` | |
| `contextReferralAgentId`, `contextPartnerAgentId`, `contextCampaignKey`, `contextCampaignMatchedBy`, `contextAttributionLinkId`, `contextCampaignUtmConfigId` | Entry context (§1), each nullable; agent, partner and campaign key indexed for reporting |
| `context` jsonb | Snapshot of the resolved context (labels included) + future dimensions |
| `idempotencyKey` | unique, nullable. Same key as the registration `Event` where one exists, so a double submit makes one entry |
| `crmDeliveryStatus`, `crmDeliveredAt`, `crmAttempts`, `crmLastError` | `pending` \| `delivered` \| `failed` \| `skipped` |
| indexes | `(leadId, occurredAt)`, `(channelId, occurredAt)`, `(crmDeliveryStatus)` partial on not-delivered |

Columns for the later channels (`crmLeadId`, `interactionType`/`interactionRef`, `handledByUserId`, `outcome`) are added with them (§11).

The lead row stays unchanged in v1 (no `firstEntryChannelId`); query `lead_entries` instead. Add denormalized columns later only if list filtering needs them.

---

## 3. Identifying the channel in flight (the crux)

### Principle: the server decides; the client may only narrow
A public form must never be able to put itself into a channel of a different type, and a bad configuration must never reject a submission. So:

1. **The ingestion path fixes the type.** Each handler knows what it is: the webinar registration handler can only produce `webinar_registration`, That holds whatever the request body says. In v1 every handler is a backend endpoint. Later, CRM intakes become handlers too, and the backend still resolves the channel (§11).
2. **The concrete object picks the channel inside that type**, from most specific to least.
3. **The client may declare an `entryChannelKey`**, which is accepted only if it is active **and the same type as the endpoint**. Otherwise it is ignored with a warn log. This covers website forms that have no backend object (e.g. a hand-built page that only sends `formKey`).
4. **Resolution never fails the request.** It always ends at the type's root catch-all.

### `EntryChannelResolverService.resolve(ctx)`
```
ctx = { type, candidates: [{entityType, entityId|entityKey}, ... most specific first],
        declaredKey?, attributes: { language, formKey, packageKey, utm } }

1. for c in candidates: binding(c) → active channel?  → resolvedBy=binding
   (archived bound channel → walk up to its nearest active ancestor, still "binding")
2. declaredKey → active && same type                    → resolvedBy=declared
3. attribute rules (Phase 5; empty in v1)                → resolvedBy=rule
4. root channel of `type`                                → resolvedBy=type_default
```
- Bindings and the tree are cached in-process with a short TTL (60 s, the same approach as `UtmLeadSourceResolverService`). Writes clear the local cache, and other instances catch up within the TTL.
- The resolver is pure lookup. It never throws, never makes network calls, and logs at warn on fallbacks that look like misconfiguration.

### Entry point → type → candidates
| Endpoint (backend) | Type | Candidates, most specific first | Gap to close |
|---|---|---|---|
| `POST /v1/internal/registration/webinar/session/:sessionId`, `POST /v1/webinars/sessions/:sessionId/registrations` (both end in `createWebinarRegistration`) | `webinar_registration` | `webinar_session`, `webinar` | none |
| `POST /v1/register/webinar` (deprecated, no session, CODEBASE_BRIEF §12.21) | `webinar_registration` | none → declared / default | accept `entryChannelKey` |
| `POST /v1/registration/consultation` (+ `/calendly`, `/calendly/:id`) | `consultation_booking` | `crm_meeting_type(meetingDetails.meetingTypeId)`, `website_form(formKey)` | `packageKey` is recorded as an **attribute** (`attributes.packageKey`), not the type. A `dealOwnerId` in the body already sets the owner, so routing with `when_owned = skip` leaves it alone |
| Public booking `POST /v1/booking/:user/:eventTypeSlug/bookings`, `/company-wide/:slug/bookings` | `consultation_booking` | `event_type` | none |
| `POST /v1/forms/submissions/form/:identifier` | `lead_magnet` if the form has an active `form_lead_magnet_links` row, else `ad_form` if a landing-page context is sent, else `ad_form` | `landing_page`, `lead_magnet`, `form` | add optional `entryContext: { landingPageId \| slug+language }` |
| `POST /v1/leads/capture` | `ad_form` | `landing_page`, `website_form(formKey)` | add the same optional `entryContext` (today it only has `formKey`) |
| `POST /v1/internal/registration/package` | `package_interest` | `crm_package(packageId)` (the CRM package id the body already carries, synced in `crm_packages`) | none. The entry is recorded at registration, before any payment |
| `POST /v1/internal/registration/masterclass/:id` | `masterclass_registration` | `masterclass` | none |
| `/v1/registration/ebook`, `/facebook-group`, `/signup`, `/property-enquiry` | `lead_magnet`, `community_join`, `signup`, `property_enquiry` | `website_form(formKey)` if sent | none |
| Partner ingestion (`leadGenerationService.ingestContact/ingestDeal`) | `partner_referral` | `partner_application` (the calling application) | the application's `partnerAgentId` fills `referral_agent` / `partner` context |
| `PATCH /v1/leads/capture/:leadUuid` | **not an entry** (follow-up on the same submission) | none | none |

### Optional hardening for landing pages (Phase 5, only if spoofing turns out to matter)
At public resolve time (`GET /v1/landing-pages/by-slug/:slug`, lead-magnet resolve), return a short-lived HMAC-signed `entryToken` (`{channelUuid, entity, exp}`) that the page posts back. A valid token counts as a binding. Not needed for v1: rule 1 already limits a forged key to channels of the same type.

### Where entries are written
One call in the shared path: `leadEntryService.recordEntry(lead, ctx, { isNewLead, idempotencyKey })`, called by each handler **after** the lead is resolved/created and **before** the CRM call. The handler passes `{ type, candidates, declaredKey, attributes }`, and the handler only describes itself. Returning leads get an entry too. A returning lead coming back through a new channel is exactly the case routing has to see.


---

## 4. Delivery to the CRM

### Wire contract
The entry rides **inside the same request** that creates/updates the contact (`contact/create`) or deal (`deal/create` for consultation/package). It is not sent as a separate call. `DealContactApiController` deliberately fires `lead_created_api` only after marketing data and the deal job have been applied. A separate call would race that trigger.

```json
"entry": {
  "uuid": "0193a1c2-…",
  "occurred_at": "2026-11-20T10:15:03Z",
  "is_new_lead": false,
  "resolved_by": "binding",
  "channel": {
    "uuid": "0193…", "key": "webinar_de_investing", "name": "Investing 101 (DE)",
    "type": "webinar_registration",
    "path": "webinar_registration/webinar_de/webinar_de_investing",
    "ancestor_uuids": ["<root>", "<webinar_de>"],
    "tags": ["market:de", "language:de"]
  },
  "source": { "entity_type": "webinar_session", "entity_id": 812, "label": "Investing 101 — 21 Nov" },
  "context": {
    "referral_agent": { "ol_agent_id": 57, "crm_user_id": 214 },
    "partner": { "ol_agent_id": 12, "crm_user_id": 88, "name": "Partner X" },
    "campaign": { "key": "partner:12:spring_sale", "matched_by": "partner_scoped", "value": "spring_sale", "label": "Partner X › spring_sale", "attribution_link_uuid": null },
    "utm": { "source": "meta", "medium": "paid_social", "campaign": "spring_villa_de" }
  }
}
```
The payload is **self-contained**: the CRM evaluates "is this entry under channel X?" from `ancestor_uuids` without calling the backend. A backend outage or slow catalog API cannot change routing.

### Owner default (blocking change)
`toCrmContactPayload` sends `lead_owner_id: resolvedOwner?.worksuiteUserId ?? CRM_SYNC_DEFAULTS.LEAD_OWNER_ID` (1). With `sales.lead-entry-channels` on, **omit `lead_owner_id` when there is no real agent**. The CRM decides. Leads with a real agent (agt link / referral) keep sending that agent. Whether channel routing may override an agent is a CRM automation decision (condition `lead_owner is empty`, see §5), not a backend one.

### Reliability
- The backend writes `lead_entries` first (`crmDeliveryStatus = pending`) and marks it `delivered` when the CRM call succeeds.
- A BullMQ job (generic worker) retries `failed`/stale `pending` entries with backoff by re-sending a **lightweight entry-only call** (`POST /api/…/lead-entries`, idempotent on `entry.uuid`). Only the original combined request fires the trigger on first delivery. A late retry fires it only if the CRM has not seen that `entry.uuid`.
- The CRM dedupes on a unique `ol_entry_uuid`, so an automation runs **at most once per entry**.

---

## 5. CRM side

### 5.1 Storage: `lead_entries` (CRM copy, read model)
`id, company_id, lead_id, ol_entry_uuid (unique), channel_uuid, channel_key, channel_name, channel_type, channel_path, channel_ancestor_uuids (json), channel_tags (json), source_entity_type, source_entity_id, source_label, is_new_lead, resolved_by, occurred_at`.
- Written by `DealContactApiController` (contact and deal create paths) inside the existing transaction, **before** `fireLeadApiTrigger`.
- `LeadMergeService` moves entries to the kept lead. Erasure deletes them with the lead.
- The lead page gets an **"Entry history"** panel. Per CLAUDE.md, the data goes through `Inertia::defer` + `<Deferred>` with a skeleton, and uses the shared `Components/Redesign` primitives. Channel names are dynamic English → `td(…, { source: "en" })`.

### 5.2 Trigger: `lead_entry_received`
- New constant `DealAutomation::TRIGGER_LEAD_ENTRY_RECEIVED`, added to `AutomationV2Feature::V2_ONLY_TRIGGERS`. It fires on **every** entry, new or returning lead: `processLead($lead, 'lead_entry_received', ['entry' => $entry])`.
- It runs **after** `lead_created_api`/`lead_updated_api`, so automations listening to those see the same state they do today. Teams are steered to the new trigger for routing.
- **Trigger scope**, like `meeting_type_ids`: new columns `entry_channel_uuids` (json) + `entry_channel_include_descendants` (bool, default true). `matchesTriggerScope` checks `entry.channel_uuid ∈ scope` or, with descendants, `scope ∩ (ancestor_uuids ∪ {channel_uuid}) ≠ ∅`. Matching is by **uuid**, so renames and re-parenting don't break automations.

### 5.3 Condition fields (`AutomationFieldCatalog` + `LeadFieldResolverService`)
| Field | Resolves from |
|---|---|
| `entry_channel` | the triggering entry (from `$context`), else the latest entry |
| `entry_channel_type` | same |
| `entry_channel_family` | same (`form` / `referral` in v1) |
| `entry_channel_tag` | tags (operator `contains`) |
| `entry_campaign` | `context.campaign.key`. Picker: house campaigns from the configs the CRM already loads through `OlUtmConfigService` (`/v1/internal/utm-configs?type=campaign`), plus partner campaigns as "Partner › value" from a new `GET /v1/internal/entry-campaigns` (keys seen on entries) |
| `entry_attribution_link` | `context.campaign.attribution_link_uuid` (a specific issued link) |
| `entry_partner` | `context.partner`; picker of CRM agents with `is_partner` |
| `entry_referral_agent` | `context.referral_agent.crm_user_id`; picker of CRM agents |
| `entry_utm_source` / `entry_utm_medium` | raw UTMs of this entry (unlike the lead's stored UTMs, which keep the first touch) |
| `entry_is_new_lead` | `is_new_lead` |
| `first_entry_channel` / `first_entry_channel_type` | the earliest entry |
| `entry_count_30d` | count of entries in the last 30 days (for "came back" rules) |

These combine with existing fields (`utm_source`, `source_id`, `lead_owner`, `primary_language`, `country`, …).

### 5.4 Action: `assign_lead_owner`
New action type for lead-subject automations (v2 only), in `DealAutomationService::performAction`'s lead branch.

| Payload | Values |
|---|---|
| `strategy` | `specific_user` \| `round_robin` \| `weighted` (Phase 5) \| `least_open_leads` (Phase 5). `interaction_handler` comes with the later channels (§11) |
| `user_id` / `pool_id` | depending on strategy |
| `when_owned` | `skip` (default) \| `overwrite` \| `overwrite_if_default_owner` |
| `notify` | bool. Reuses `LeadOwnerAssigned` |

**Assignment pools** (`lead_assignment_pools`, `lead_assignment_pool_members`): `name, strategy, cursor, active`. Members are `user_id, weight, active`. Members are skipped when the user is inactive (`ActiveScope`) or flagged unavailable.
- Round-robin is concurrency-safe: `SELECT … FOR UPDATE` on the pool row inside a transaction, advance the cursor, commit. Two simultaneous webinar signups must land on different people.
- Every assignment writes a `DealAutomationLog` row (pool, chosen user, reason) and a timeline event, so "why does X own this lead?" can always be answered.
- **Don't reuse** the category round-robin in `DealObserver::creating`. It reads `request()` and assigns deal agents, not lead owners.

Precedence is configured as data, not code, via `priority` + `when_owned`: an agent-referred lead already has an owner, so `skip` leaves it alone by default.

When a campaign or partner rule and a channel rule both match one entry, both automations run in `priority` order. The first assigns an owner and the second skips (`when_owned = skip`). So "campaign beats channel" is simply giving campaign/partner routing automations a higher priority.

### 5.5 Channel management UI (in the CRM, data on the backend)
- **Settings → Lead entry channels** (Redesign token set): a tree with drag to re-parent within a type, a create/edit modal (name, key, parent, tags), archive, a bindings tab per channel with an entity picker, and per-channel entry counts.
- CRM controllers call the backend through a new `OlEntryChannelService` (same shape as `OlUtmConfigService`: `services.ol.base_url` + API key, cached reads). The CRM forwards the acting user as `X-Acting-User` (CRM user id + email) for the backend audit log. API-key auth has no user identity of its own.
- The automation builder's channel picker reads the same cached catalog (tree, **including archived**, so old automations still show a label).

---

## 6. Backend APIs

| Route | Auth | Purpose |
|---|---|---|
| `GET /v1/internal/entry-channels` | API key, registered route key | Full tree (active + archived), `updatedSince`/ETag for cheap polling |
| `GET /v1/internal/entry-channel-types` | API key | Type registry (labels, allowed binding entity types) |
| `POST/PATCH /v1/internal/entry-channels`, `POST …/:uuid/archive`, `POST …/:uuid/move` | API key **+ explicit grant** (writes) | Management from the CRM |
| `GET/POST/DELETE /v1/internal/entry-channels/:uuid/bindings` | API key + explicit grant | Bind objects. 409 if the object is already bound elsewhere, with a `move` option |
| `GET /v1/internal/entry-channels/bindable?entityType=webinar&search=` | API key | Picker source: our webinars, event types, lead magnets, landing pages (+ language), packages |
| `GET /v1/internal/lead-entries?leadUuid=` | API key | Backend-side history (support/debugging) |
| `/v1/entry-channels/*` | OIDC + RBAC `marketing.entry-channels:list\|create\|update\|archive` | Same management for the Backoffice, if wanted |

Mount order and `createRegisteredRouter` follow CODEBASE_BRIEF §12. Validation is Joi with unknown keys rejected, and ids in bodies accept id or uuid, resolved once (brief §6).

---

## 7. Feature flags

| Flag | Repo | Off means |
|---|---|---|
| `sales.lead-entry-channels` | backend | No `recordEntry`, no `entry` in CRM payloads, owner default unchanged |
| `crm.lead-entry-routing` | CRM | Entries are still stored if received, but the trigger/action are hidden and not fired. Also requires `crm.automation-v2` |

Rollout: backend flag on first (entries recorded, not yet routed; check catch-all volume) → bind objects → CRM flag on → create routing automations → only then omit the default owner (owner omission sits behind a second backend flag `sales.lead-entry-owner-handoff`, so "record" and "hand off ownership" go live separately).

---

## 8. Phases

**Phase 0 — Decisions** (product + eng, see §10). Naming, initial type list, initial tree, owner-handoff policy.

**Phase 1 — Backend registry** (no behavior change)
- Type registry, migrations + models for `entry_channels`, `entry_channel_bindings`, `lead_entries`. Seeder for the root channels.
- `EntryChannelService` (CRUD, move with subtree path rebuild, archive, depth/type invariants), `EntryChannelBindingService`, `EntryChannelResolverService` + cache.
- Internal + backoffice routes, permissions seeder, route-key registration.
- Registry fields `family`, `entryPolicy`, `origin` (only `every_submission` / `backend` implemented).
- Context dimension registry + resolvers for `referral_agent`, `partner`, `campaign`; context columns on `lead_entries`.
- `agents.isPartner` (synced from CRM `lead_agents.is_partner`), `applications.partnerAgentId`, `utm_id=<link uuid>` on attribution link URLs, `utmId` in `registrationUtmInfoSchema`.
- Tests: resolver precedence, type-mismatch declared key ignored, archived → ancestor fallback, one-binding-per-object, move rebuilds paths, never-throws.

**Phase 2 — Backend emission**
- `leadEntryService.recordEntry` + every handler in the §3 table, including returning leads, with idempotency shared with registration `Event`s.
- `entryContext` on `/leads/capture` and form submissions.
- `entry` (with `context`) in contact/deal CRM payloads, `crmDeliveryStatus` handling, BullMQ retry job.
- Owner-default omission behind `sales.lead-entry-owner-handoff`.
- Update `docs/CODEBASE_BRIEF.md` (§6 data model, §8 conventions, §12 gotcha: "a channel is not a lead source").

**Phase 3 — CRM intake + automation**
- `lead_entries` migration/model, writing in `DealContactApiController` before triggers, entry-only idempotent endpoint, merge/erasure handling.
- `TRIGGER_LEAD_ENTRY_RECEIVED`, scope columns + `matchesTriggerScope`, condition fields, `OlEntryChannelService`, picker in the automation builder.
- Feature tests: one automation run per entry uuid, scope with descendants, returning lead fires the trigger, trigger sees marketing + deal state.

**Phase 4 — CRM assignment**
- Pools + members (settings UI), `assign_lead_owner` action with `specific_user` + `round_robin`, `when_owned`, notification, logs/timeline.
- Concurrency test (parallel assignments advance the cursor without collisions).

**Phase 5 — Scale and cleanup**
- Channel management UI in the CRM (tree, bindings, counts). This can move earlier if admins need it before the CRM routing work.
- Attribute rules in the resolver (e.g. "all webinars with language=de → Webinar DE"), so new objects route without manual binding.
- "Unbound sources" report (entries with `resolvedBy = type_default`, grouped by source entity).
- `weighted` / `least_open_leads` strategies. Availability / out-of-office.
- Backfill: map historical `events` (`EventName` → type, with the event's entity where known) into `lead_entries` with `resolvedBy = type_default` or `binding`. Mark backfilled rows `metadata.backfilled = true` and **never deliver them to the CRM as triggers**.
- Consolidation: `entry_channels.crmLeadSourceId` can replace `crm_lookup_entries(kind=lead_source)` formKey rows.
- `meta_lead_form` type once Meta lead-ads ingestion exists (goes through `leadEntryService`, per the brief).
- Optional signed `entryToken` for landing pages.

**Phase 6 — Verification**: an end-to-end walk per channel type in staging (submit → backend entry → CRM entry → automation log → owner set), plus the catch-all volume check before turning on owner hand-off.

---

## 9. Edge cases to keep in tests

- Same person signs up for a webinar, then books a consultation: two entries, two trigger runs, and the second is skipped when `when_owned = skip`.
- Double-submitted form: one entry (idempotency key), one automation run (CRM `ol_entry_uuid` unique).
- Channel archived while still bound: resolves to its nearest active ancestor. A public form is never rejected.
- Channel re-parented: old entries keep their snapshot path. Automations by uuid + descendants follow the new tree for new entries.
- Binding deleted: future entries fall back to declared/type default.
- CRM down during registration: the entry stays `pending`, the retry delivers it, and the trigger fires once.
- CRM lead merge: entries follow the kept lead. Erasure removes them on both sides (`scripts/erase-lead-contact.ts` must delete backend `lead_entries` too).

---

## 10. Open questions (Phase 0)

1. **Agent-referred leads**: should channel routing ever override an agt/referral owner? The design default is no (`when_owned = skip`), but it is configurable per automation.
2. **Returning leads with an owner**: reassign on a "stronger" channel (e.g. consultation after a webinar)? This is expressible as an automation with `overwrite`. Confirm that's the desired default.
3. **Initial tree**: which sub-categories are needed on day one (by language/market? by product?), and which belong in tags instead.
4. **Consultation vs package**: a consultation about a specific package is typed `consultation_booking` with a package tag. Confirm, or should it be `package_interest`?
5. **Who manages channels**: CRM admins only, or marketing in the Backoffice too (both APIs are planned; pick one UI to build first).
6. **CRM lead source overwrite**: CODEBASE_BRIEF says the CRM overwrites an existing contact's `source_id` when a different `lead_source_id` arrives, but `DealContactApiController::fillExistingContactBasics` currently only fills it when empty. Verify which is true and fix the brief. It doesn't block this work, since channels don't touch `source_id`.
7. **Partner flag on the backend**: add `agents.isPartner` synced from the CRM's `lead_agents.is_partner` (recommended), or treat the top of each agent's `parentId` chain as the partner? The second needs no sync but is wrong if partners sit under other agents in the hierarchy.
8. **Website forwarding `utm_id`**: the website (not in these repos) must pass `utm_id` in `utmInfo` like the other UTMs. Until it does, campaigns resolve through steps 2–5.
9. **Partners' own links**: do partners run campaigns with links they build themselves (step 3, scoped by partner), or should they get links from our attribution link tool (step 1, exact)?

---

## 11. Later channels: email, WhatsApp, Instagram, inbound calls (acknowledged, not built)

Not available yet. This section records how they fit, so v1 doesn't close the door on them. Build them only once their intake exists and the questions at the end are answered.

| Family | Types | Picked up by (today's CRM code) |
|---|---|---|
| `conversation` | `inbound_email` (shared inbox, e.g. info@), `whatsapp_message` (company number), `instagram_dm`, `instagram_comment` | CRM Email module review queue; CRM `CommunicationActivity` intake |
| `call` | `inbound_call` | CRM / CallBridge (`LeadPhoneMatcher`, CRM-pushed call events) |
| `internal` | `crm_manual`, `crm_import` | CRM lead create / import flows, where they opt in |

- **Instagram DM and comment are two types, not one.** They arrive through different webhook paths and mean different things: a comment is public, often on an ad, and the binding is the post/ad, not the account. "Any Instagram" is a tag (`platform:instagram`) carried by both roots.
- New binding entity types: `mailbox` (inbox address), `whatsapp_number` (E.164 / WABA phone-number id), `instagram_account`, `instagram_media` (post/ad id), `phone_line` (dialled number / CallBridge integration).

### Entry points
| Source (CRM) | Type | Candidates | Notes |
|---|---|---|---|
| CRM Email module: a shared-inbox message approved in the review queue (`Email/Review/CreateLeadFromCopy`, `LeadCreator`), or a message from a known lead | `inbound_email` | `mailbox(to-address)` | report to backend. **Entry happens at review approval**, not on receipt, so spam and vendors never become entries. `occurredAt` = message time |
| CRM `CommunicationActivity` intake, `channel_type = whatsapp` (`POST /api/internal/communication-activities`) | `whatsapp_message` | `whatsapp_number(receiving number)` | report to backend. The activity must carry the receiving number |
| same, Instagram DM | `instagram_dm` | `instagram_account` | report. The identity is the handle / IGSID only (see "Identity" below) |
| same, Instagram comment | `instagram_comment` | `instagram_media(post/ad id)`, `instagram_account` | report. The ad id also goes into `attributes` |
| CallBridge inbound call (CRM `LeadPhoneMatcher` + CRM-pushed call events → backend `/v1/call-bridge/emit`) | `inbound_call` | `phone_line(dialed number)` | report, with `outcome` and `handledByUserId` |

### Conversations are not submissions (entry policy)
A form submission is one discrete conversion. A WhatsApp thread can be 40 messages. If every inbound message were an entry, every message would re-run routing. The type's **entry policy** decides:

- `every_submission` (forms): every submission is an entry.
- `conversation_window` (messages, calls): an inbound counts as an entry **only if** (a) it creates the lead, or (b) the lead has no inbound on that **same type** in the last *N* days (registry default 30, configurable per root channel). Everything else is just an interaction: it stays in `CommunicationActivity` / call logs with no entry and no trigger.

The check runs in the backend resolver (`lead_entries` has the history), so every origin applies the same rule. The response says `{ recorded: false, reason: "within_window" }` when it isn't an entry.

### Identity (conversation channels)
Forms always give an email or phone. Conversation channels may only give an Instagram handle, a WhatsApp number, or a withheld caller id.

- The entry needs a lead (backend `leadId` or CRM `crmLeadId`). The CRM intake already finds or creates leads by handle/phone (`CommunicationActivityResolverService`, `LeadPhoneMatcher`, `lead_contact_methods`), so for CRM-originated entries **the CRM resolves the lead and the backend only records the entry**. The backend dedup policy does not need to learn about handles.
- **No identifiable contact means no entry.** A withheld number, or a message the intake can't attach to or create a lead from, stays an interaction. When it is later linked to a lead by hand, the user can choose "record as entry".

### CRM-originated entries
Here the direction is reversed: the CRM detects the event and the backend resolves and stores it.

1. The CRM intake finds or creates the lead (existing code), then calls `POST /v1/internal/lead-entries` with `{ type, crmLeadId, olLeadUuid?, candidates, interaction: {type, ref, handledByUserId, outcome}, occurredAt, idempotencyKey }`. The idempotency key is the message id / call id.
2. The backend applies the entry policy, resolves the channel, stores the row (`origin = crm`, `crmDeliveryStatus = delivered`) and returns the same `entry` object as in the wire contract, or `{ recorded: false, reason }`.
3. The CRM writes its `lead_entries` copy and fires `lead_entry_received`, following the same steps as backend-originated entries.

The resolver is an in-memory lookup, so the call is fast. It sits behind a short timeout (2 s) and is never on a webhook's response path: the CRM does it in a queued job after the intake has stored the activity. **If the backend is unreachable, the job retries with backoff.** Routing is late, never wrong. The CRM must not resolve channels itself as a fallback, because two resolvers would drift.

**Every entry, from either system, lives in backend `lead_entries`.** There is no CRM-only channel store.

### Additions when built
- **Backend schema:** `lead_entries.leadId` becomes nullable; add `crmLeadId` (CHECK at least one of the two; backfill `leadId` once the lead is linked via `leads.crmId`), `interactionType` / `interactionRef` (CRM activity id, email message id or CallBridge call uuid), `handledByUserId`, `outcome` (`answered` \| `missed` \| `voicemail`).
- **Backend API:** `POST /v1/internal/lead-entries` (API key + explicit grant): applies the entry policy, resolves, records and returns the entry snapshot. Idempotent on `idempotencyKey`. `GET /v1/internal/lead-entries` also accepts `crmLeadId`.
- **Resolver:** the `conversation_window` entry policy.
- **CRM conditions:** `entry_outcome`, `entry_has_handler`; `entry_channel_family` gains `conversation` / `call`.
- **CRM action:** `assign_lead_owner` strategy `interaction_handler` (assign the person who took the call or approved/answered the message) with `fallback_pool_id` for entries with no handler (a missed call, an unanswered DM). Live call routing (which phone rings) stays in the phone system.
- **Owner defaults in the CRM:** `Email/Review/LeadCreator` sets `lead_owner` = the reviewer, and `CommunicationActivityResolverService` sets the matched agent, else `company.default_lead_creator_id`. Under the hand-off flag they keep a positively identified agent but leave the owner empty instead of a default; the reviewer/handler is passed as `handledByUserId`.
- **CRM jobs:** a queued `ReportLeadEntryJob` (retry/backoff) called from Email review approval, the `CommunicationActivity` intake (which must start storing the receiving number / account / media id) and CallBridge inbound calls.

### Tests when built
- A 40-message WhatsApp thread is 1 entry; the same lead back after the window is a 2nd entry; a withheld caller is no entry.
- Backend down: the entry is delivered later and the trigger fires once.
- Instagram comment and DM from the same person on the same day: two types, so two entries; the second is usually skipped by `when_owned = skip`.
- An email to info@ from an existing lead's address: an interaction, not an entry, unless the lead's last `inbound_email` is outside the window.
- A missed call followed by a call-back the lead answers: the missed inbound call is the entry; the outbound call-back is not.
- A message from an unknown contact linked to a lead by hand later: "record as entry" with the original message time.

### Questions to answer before building
1. **Conversation window length**: 30 days by default. Should it differ per type (e.g. shorter for calls), or should "returning" mean the lead is closed/lost in the CRM instead of a number of days?
2. **Email entries at review approval**: confirm the review queue is the gate (no entry for unreviewed shared-inbox mail), and which inboxes count (only info@, or any shared inbox connected to the Email module).
3. **Instagram/WhatsApp intake**: what will feed `POST /api/internal/communication-activities`, and can it send the receiving number / account / post id? Without that, everything lands in the type catch-all, which still works with one channel per company number/account.
4. **CRM-created leads**: which manual/import flows should record an entry at all (a manual create usually already has an owner).
