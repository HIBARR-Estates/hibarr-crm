# Entity AI Summary — Component Spec (HIB-970)

## Overview

Reusable `EntityAiSummaryCard` for lead and deal record views. Renders structured JSON from the Lead/Deal Summary agents. First integration: legacy lead show, then lead redesign, then deal views (HIB-972).

**Feature flags:**
- Leads: `crm.lead-ai-summary`
- Deals: `sales.ai-entity-summary`

## Component anatomy

```
┌─ EntityAiSummaryCard (purple left accent) ─────────────────────────┐
│ Header: [AI icon] AI Lead Summary · refreshed 4 min ago  [Regenerate]│
├─────────────────────────────────────────────────────────────────────┤
│ Status line (1–2 sentences, risk-aware styling)                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                             │
│ │ Chip 1   │ │ Chip 2   │ │ Chip 3   │  (key facts, tone-colored)   │
│ └──────────┘ └──────────┘ └──────────┘                             │
│ • Bullet 1                                                          │
│ • Bullet 2                                                          │
│ • Bullet 3                                                          │
├─ Next step footer (dark bar) ─────────────────────── [CTA button] ┤
└─────────────────────────────────────────────────────────────────────┘
```

## States

| State | UI |
|-------|-----|
| Empty | Prompt to generate; no auto-fetch on load |
| Loading | Skeleton over card body; Regenerate disabled |
| Cached | Full card; timestamp from `meta.generated_at` |
| Error | Inline message + retry |
| Low confidence | Show `data_confidence: low` badge when `meta.data_confidence === 'low'` |

## JSON contract

See `lead-summary-agent-prompt.md` OUTPUT block. TypeScript types in `resources/js/Types/entity-summary.ts`.

For leads (prompt v2) the summary is **written prose, not a form** (layout "C1" in the design canvas):

- `status_line` — a one-sentence takeaway (≤ 20 words). In the redesign card it is shown large at the top of the body, and in the header only while the card is collapsed.
- `summary` — a 3–4 sentence paragraph (≤ 80 words): who they are and what they want, where things stand, what is open, what we don't know. `**…**` marks up to four key facts (blue highlight) and `==…==` the one open item or risk (amber). `EntityAiSummaryProse` renders the markers as `<mark>` elements — never as injected HTML.
- `facts` — 3–6 `{kind, value}` items shown by `EntityAiSummaryFacts` as icon + value with no visible label (the kind is announced to screen readers). Kinds: `property`, `location`, `budget`, `timeline`, `purpose`, `decision_makers`, `languages`, `based_in` (`EntitySummaryValidator::LEAD_FACT_KINDS`).
- `chips` and `bullets` come back empty. The card still renders them for older stored lead summaries and for all deal summaries.

In the lead layout Regenerate sits in the header row (beside, not inside, the collapse toggle) instead of at the bottom of the body. `EntitySummaryValidator::validateLeadSummary` requires `summary`, checks `facts`, and no longer requires a chip. `LeadSummaryServiceTest` holds the prompt's example to all of these limits.

## Lead summary input (prompt v2)

`LeadSummaryInputBuilder` builds the payload; `lead-summary-agent-prompt.md` documents it ("INPUT YOU WILL RECEIVE"). The two are a contract — `LeadSummaryInputBuilderTest::test_every_payload_key_is_documented_in_the_prompt` fails if a key is added to one and not the other. Bump `PROMPT_VERSION` in `LeadSummaryService` when the prompt changes; changing the payload also changes `inputHash`, which marks existing stored summaries stale.

What the model receives: lead type/source/category/temperature, day counts (precomputed — the model does no date arithmetic), a PII-free profile (nationality, country, city, languages, occupation, age range, preferred contact time, and *which* contact channels exist), the lead's initial message, the latest qualification call(s) as question + answer, custom fields on the lead, up to 10 notes (600 characters each), meetings, tasks, campaign and engagement data, and linked deals (the Deal Summary agent's own risk conclusion plus the buying intent captured on the deal).

**Privacy.** The payload never contains the lead's name, email, phone numbers, date of birth, street address, company, tracking identifiers (IP, user agent, ad-click ids) or deal names (deals are routinely named after the person). Free text — notes, qualification answers, custom fields, the deal agent's prose — passes through `LeadSummaryRedactor`, which masks emails, phone numbers and the lead's own name/company (`[email]`, `[phone]`, `[name]`) because people type contact details into notes. Custom fields whose label looks like an identifier (passport, ID, tax, bank, address, phone, email, …) and file fields are dropped. City, country and nationality are passed deliberately — they are coarse and decide what a salesperson says next — remove them from `buildProfile()` if that is not acceptable.

**Qualification answers need a snapshot.** The qualification script (question and option text) lives in OL and is only loaded in the browser; the CRM used to store only `segment_key` and an option key. `lead_qualification_answers` now also stores `question_label` and `answer_labels`, written by `useQualificationFlow` on every save. Answers saved before this change have no snapshot: they reach the model only if they carry typed text, and otherwise are skipped.

## Action routing

| `action_type` | Navigation |
|---------------|------------|
| `OPEN_DEAL` | `deals.show` with `target_deal_id` |
| `REVIEW_DEALS` | `lead-contact.show` with `?tab=deals` |
| `CONTACT_LEAD` / `SCHEDULE_CALL` | `tel:` if phone, else qualification tab |
| `QUALIFY_LEAD` | Qualification tab / scroll to workspace |
| `CREATE_TASK` | Workspace tasks sub-tab on deal |
| `REQUEST_DOCUMENTS` | Workspace files sub-tab on deal |
| `ADVANCE_STAGE` | Stage advance UI when provided |
| `REVIEW_STALE_DEAL` | Timeline tab on deal |
| `NO_ACTION_NEEDED` | Hide CTA |

## Placement

- **Legacy lead:** Above tabs in `LegacyLeadShow.tsx`
- **Redesign lead:** Below `LeadIdentityHeader`, above `LeadMissionBar` (coexists in v1)
- **Legacy deal:** Above `DealTabs` in `LegacyDealShow` (`Show.tsx`)
- **Redesign deal:** Below `DealStickyHeader` (stage stepper), above `DealMainTabs` in `DealViewRedesign.tsx`

## API

### Lead
- `GET /account/lead-contact/{lead}/ai-summary`
- `POST /account/lead-contact/{lead}/ai-summary/regenerate`

### Deal
- `GET /account/deals/{deal}/ai-summary`
- `POST /account/deals/{deal}/ai-summary/regenerate`

## v1 deferrals

- Regenerate dropdown chevron: button only
- Lead summary has no `last_engagement_at` any more (it was `created_at` in disguise); marketing engagement is the real flags plus `last_webinar_days_ago`
- `partner_information`: omitted unless in custom fields (which are sent as `lead_details`)
