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

**Header (redesign lead card).** `[spark  AI LEAD SUMMARY · 2 minutes ago] ........ [Confidence: high] [Regenerate] [arrow]`. The generated time is part of the label; the confidence badge (green / amber / neutral for high / medium / low, hidden while the summary is out of date) replaces the risk badge, which this layout does not show; Regenerate follows it, and the accordion arrow is furthest right. The arrow is the keyboard- and screen-reader-accessible toggle (`aria-expanded`); clicking the label area also toggles, as a pointer convenience. The takeaway and paragraph use the full width of the card. `EntitySummaryValidator::validateLeadSummary` requires `summary`, checks `facts`, and no longer requires a chip. `LeadSummaryServiceTest` holds the prompt's example to all of these limits.

## Naming the lead: replacement tokens

The model is never told who the lead is (see Privacy below), yet a summary that says "the lead" everywhere reads as impersonal. So the model writes a **token** where it would name the lead, and the card fills in the real name when it renders:

| Token | Becomes |
|-------|---------|
| `{{lead_first_name}}` | the first word of the lead's `client_name` (the default; `{{lead_first_name}} wants …`) |
| `{{lead_full_name}}` | the whole `client_name` (sparingly) |

- **Substitution happens in the card, after translation.** Every part that shows AI text does `personalize(td(text))`. `td()` sends text to the dynamic-translation service (which already protects `{{…}}` tokens), so a name substituted before `td()` would be sent to it. `EntityAiSummaryCard` takes the name as `leadName` (both lead pages pass `lead.client_name`) and provides it through `SummaryPersonalizationProvider`; `usePersonalize()` is what the prose, facts, next step and header call.
- **The stored summary holds tokens, never the name**, so renaming a lead needs no regeneration, and the name is not in `entity_ai_summaries`.
- **A missing name never shows raw braces.** The token becomes "the lead" ("The lead" at the start of a sentence); a made-up `{{…}}` token is dropped. Names are stripped of `**`, `==` and `{{`/`}}` before use, so a name cannot add a highlight or a token.
- **Server side**, `LeadSummaryTokens::sanitize()` runs after validation: known tokens are normalised (`{{ Lead_First_Name }}` → `{{lead_first_name}}`) and anything else is deleted before the summary is stored.
- **One list in three places** — the prompt, `LeadSummaryTokens::NAMES` and `SUMMARY_TOKEN_NAMES` in `summaryTokens.ts` — and `LeadSummaryTokensTest` fails if they differ. To add a token, change all three and the prompt's examples.
- Not covered: other people named in notes (a partner, a colleague) are not tokens; the model calls them "their partner". Older summaries have no tokens and render as before.

## How the lead summary calls the AI service

`LeadSummaryService` → `EntitySummaryAgentInterface::executeAgentBySlug($slug, $input)` → `HibarrAiSummaryService` → `POST {AI_BASE_URL}/ai/execute/{slug}` with header `x-api-key` and body `{"userPrompt": "<the lead JSON>"}`. The reply is `{success, message, data: {slug, provider, model, output, usage}}`; `data.output` is the model's JSON text (a markdown fence is tolerated), which the validator then checks.

The slug is `services.ai.lead_summary_slug` (`AI_LEAD_SUMMARY_SLUG`, default `lead-summary`). **The CRM sends no prompt, provider, model, feature context or token limit** — they are columns on the `ai_configs` row, created by hibarr-backend seeder `20261104000001-seed-lead-summary-ai-config` (openai / `gpt-4o`, `featureContext` `lead_summary`, 2048 tokens) and changed with `PATCH /v1/ai/configs/lead-summary`, no CRM deploy. `lead-summary-agent-prompt.md` is the readable source of the wording and the JSON contract; keep it in step with the row. The summary stores the slug as `prompt_version`.

Deal summaries and the Reports notes summary are unchanged and still use the generic `POST /ai/execute` with a prompt sent from the CRM.

Failure modes: a 404 means no active config with that slug (the seeder has not run in that environment — deploy the backend seeder first); any failure keeps the previous AI summary if there is one, otherwise shows the fallback summary. Because the slug route carries no `userId`, the AI service records these calls with a null user in its usage events; the `lead_summary` feature key still groups them.

## Lead summary input (prompt v2)

`LeadSummaryInputBuilder` builds the payload; `lead-summary-agent-prompt.md` documents it ("INPUT YOU WILL RECEIVE"). The two are a contract — `LeadSummaryInputBuilderTest::test_every_payload_key_is_documented_in_the_prompt` fails if a key is added to one and not the other. Changing the payload also changes `inputHash`, which marks existing stored summaries stale.

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
