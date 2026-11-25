# Lead financial assessments — plan of action

Status: **PLAN (rev 2) — decisions in §11 resolved; awaiting explicit go-ahead to start the mockup. No code, migrations or mockups have been produced.**
Feature flag (proposed): `crm.lead-financial-assessments`

## 1. Intent (as understood)

- A lead's financial situation is captured as an **additive** model attached to the lead: each assessment is a dated snapshot, and the lead's picture is refreshed periodically as new information arrives. Old snapshots are kept, never overwritten.
- Assessment **line kinds** and **line types** are **configurable** (admin adds new ones later with no code change).
- Assessment data is **collectable on the lead page**, **viewable** there, available to **automations**, to the **mapped lead fields exposed via APIs**, and **filterable** on the lead list.

## 1b. What "additive" means here (D1)

1. **Additive over time.** Nothing is overwritten. Each refresh is a new dated snapshot; old ones stay readable. Example: *Jan call* — salary 6,000/mo, savings 40,000 → finalised as **A1**. *April call* — a draft is cloned from A1, salary becomes 6,500 and a new commitment is added → finalised as **A2**, A1 becomes `superseded`. The page can show salary 6,000 → 6,500 (+500) and "new: commitment", and history keeps both.
2. **Additive to the CRM.** New tables only. Nothing is added to or changed on `leads`, custom fields or deals, so existing screens, exports and integrations keep working untouched.
3. **Additive inside a draft.** Information arriving from different places (agent typing during a call, a website form via the API) accumulates into the one open draft; it merges by line, it does not replace the draft. A second source adding a line of an existing type is governed by the write mode (`fill`/`overwrite`/`append`).
4. **Not additive in the arithmetic sense.** Totals are computed from the lines of one assessment only; values are never summed across snapshots (that would double-count).
5. **Finals are immutable.** A correction is a new draft that supersedes, so an automation or decision made on A1 can always be reconstructed.

## 2. What the codebase already gives us (and where assessments plug in)

| Concern | Existing surface | Finding |
|---|---|---|
| Lead page | `Pages/Leads/Redesign` — tabs in `config/workspaceTabs.ts`, state in `context/LeadWorkspaceContext.tsx`, one `hooks/useLead*.ts` per mutation, qualification tab gated by `crm.lead-qualification-tab` | New "Financials" record tab, same pattern. Deferred prop + `<Deferred>` + skeleton; mutations patch context, no Inertia reload |
| Mapped fields → API | `Services/LeadFieldCatalog` served by `GET api/lead-fields`; written through `lead_fields` on `contact/create` by `LeadFieldWriter` (accepts a plain value or `{value, mode}`, reports `skipped_lead_fields` with reasons, never fails the request) | **This is the surface to extend (decision D5).** It is column-driven and its cache is **not per-company**, so assessment fields (per-company config, not columns) need a company-aware extension (see §6) |
| Automations | `LeadAutomationService` → `LeadFieldResolverService::resolve()` (native column / `custom_field_{id}` / `followup_*`); `AutomationFieldCatalog`; builder UI `Pages/Settings/Automation/config/builderFields.ts` + blade rows; operators `= > < contains exists changed` | Add a `financial_*` resolver branch, catalog entries, builder options, and triggers. `changed` only works on native columns (see §7) |
| Filters | `LeadService::FILTER_KEYS` / `filtersFromRequest` / `sanitizeFilterPayload`, `LeadFilterFacetsService`, `configs/leadFilterConfig.ts`, `LeadSavedView.filters`, flag `crm.leads-filter-v2` | Add filter keys + UI config. Numeric/derived filters need an indexed summary row (see §5) |
| FX | `ExchangeRateService` (Frankfurter/ECB, 12h cache, **fiat only**) | Reuse for fiat. Crypto gets a sibling `CryptoRateService` backed by a free exchange-data API (D4, §4.4) |
| Conventions | bigint ids, `company_id` + `HasCompany`, `BaseModel`, MySQL in prod / SQLite in tests, migrations dated `2026_MM_DD_…` | Diagram uses uuid and `CONTACTS`; here the contact **is** `leads` and ids are bigint |
| Not yet verified | lead automation trigger list, permission registration pattern, `LeadMergeService` handling of child tables, GDPR removal (`RemovalRequestLead`), `LeadExportFields`, AI summary agents' data access | Checked at the start of the phase that touches each; any surprise gets reported before building on it |

## 3. Technical issues from the diagram review → resolution

| # | Issue | Resolution |
|---|---|---|
| T1 | `kind` / `type` were free-text varchars | Two config tables (§4). Calculator is driven by a kind's **role**, not its key, so a brand-new kind works in totals immediately |
| T2 | Referenced tables undrawn (users, documents) | `prepared_by`/`verified_by` → `users`; `proof_file_id` → existing `lead_contact_files` upload path |
| T3 | Nullability unspecified | Defined in §4 (only `lead_id`, `as_of_date`, `status`, `source`, `currency`, and line `type_id`/`amount`/`currency`/`frequency`/`certainty` are required) |
| T4 | No uniqueness rule | Max **one open draft** and **one current final** per lead, enforced by a nullable unique helper column (`draft_lead_id`, `current_lead_id`) maintained in code — portable to MySQL and SQLite, no partial/generated indexes |
| T5 | "Commitment" handling unstated | Role `commitment` = recurring outflow; reported as `commitments_monthly` and `disposable_monthly`, **not** subtracted from `available_now` |
| T6 | "Available now" formula undefined | Defined in §4.4; override recorded next to the computed value, reason mandatory |
| T7 | Deal link lived on an undrawn column | **Deferred** — you asked for a lead-level model. Optional `deals.financial_assessment_id` can be added later without rework |
| T8 | `contributorContactId` null semantics; spouses are rarely leads | Replace with `contributor_label` (e.g. "Spouse") + optional `contributor_lead_id`. Null both = the lead themself |
| T9 | `F1 'verified'` unresolved | **Resolved (Q1):** `verified_at` is simply when the assessment was verified; `verified_by_user_id` records who |
| T10 | Crypto vs fiat-only FX | **Resolved (D4):** live crypto rates from a free exchange API; line `currency` widened to `varchar(10)` because tickers such as `USDT` exceed `char(3)` |
| T11 | `totalsAtFinal` shape unstated | Fixed JSON schema incl. `rates`, `rates_as_of`, `calc_version` (§4.4) so old finals stay reproducible after formula changes |
| T12 | Sensitive data | Dedicated permissions, excluded from outbound email merge tags and AI summaries by default, GDPR erasure + merge handling (§8) |

## 4. Data model

All tables: bigint id, `company_id` (+ `HasCompany`), timestamps, soft deletes unless noted.

### 4.1 Configuration
- `financial_assessment_kinds` — `key` (unique per company, immutable), `label`, **`role`** enum `income | asset | funding | commitment`, `sort_order`, `is_active`, `is_system`.
- `financial_assessment_line_types` — `kind_id`, `key` (unique per company, immutable), `label`, `default_frequency` (nullable), `default_certainty` (nullable), `sort_order`, `is_active`, `is_system`.
- Seeded per company: kinds `income / saving_asset / funding_source / commitment` (roles to match); types `salary, bank, crypto, property_sale, rent` (+ a few obvious ones, to be agreed). Types/kinds are **deactivated, never hard-deleted**, so history stays readable. A type cannot move kind once lines exist.
- Labels editable, keys frozen. Seeded labels via lang files (`t()`); admin-created labels via `td()`.
- Settings UI under the existing lead settings hub (list, add, rename, reorder, deactivate). Company settings: reporting currency (default = company currency) and stale-after days (default 90).

### 4.2 `financial_assessments`
`lead_id`, `as_of_date`, `status` (`draft|final|superseded`), `source` (`call|consultation|client_form|api|manual`), `currency`, `prepared_by_user_id`, `finalised_at`, `verified_by_user_id?`, `verified_at?`, `available_now_override?`, `override_reason?`, `totals` (JSON, set at finalise), `supersedes_assessment_id?`, `notes?`, helpers `draft_lead_id?` / `current_lead_id?`.
Rules: a final is immutable (lines locked); correcting a final = new draft that supersedes it; override requires a reason; verification is a separate action from finalising.

### 4.3 `financial_assessment_lines`
`assessment_id`, `type_id`, `amount`, `currency` (`varchar(10)`: ISO fiat code or crypto ticker), `frequency` (`once|monthly|yearly`), `available_from?`, `certainty` (`confirmed|likely|uncertain`), `contributor_label?`, `contributor_lead_id?`, `proof_file_id?`, `note?`, **`previous_line_id?`** (carry-forward link, powers "changed since last time"), `sort_order`.

**Additive refresh:** starting an update clones the current final's lines into a new draft (`previous_line_id` set). The agent edits only what changed; finalising supersedes the old one. History/trend comes from the chain.

### 4.4 Calculator (pure class, no hooks/DB — unit-tested)
- Normalise every line to the assessment currency; rates used are frozen at finalise.
  - **Fiat** → `ExchangeRateService` (ECB).
  - **Crypto** → new `CryptoRateService` behind a small provider interface; default provider **CoinGecko** (CoinMarketCap pluggable). Free tiers need an API key (`COINGECKO_API_KEY` in env, never committed) and are rate-limited, so requests are batched (one call for all tickers on the assessment) and cached for minutes, not hours. If the provider cannot quote the reporting currency, convert via USD then ECB.
  - Supported crypto assets are a small config table (`ticker ↔ provider asset id`, e.g. `BTC ↔ bitcoin`) editable next to kinds/types, so a new coin needs no deploy.
  - Drafts show a live **indicative** rate; only finalise freezes it. If the provider is down, finalise is blocked with the affected tickers listed, and a manual rate can be entered as an explicit fallback (stored as `rate_source: manual`).
- Per role: `income_monthly` (monthly, yearly÷12), `assets_total`, `funding_total`, `commitments_monthly`, `disposable_monthly = income_monthly − commitments_monthly`.
- `available_now` = confirmed assets + confirmed funding with `available_from ≤ as_of_date` (null = now). `available_projected` adds `likely`. `uncertain` is reported separately, never summed into either.
- Frozen JSON: `{calc_version, base_currency, rates, rates_as_of, totals{…}, by_kind{key:…}, by_type{key:…}, computed_available_now, available_now_override}`.
- Never silently 0: an unavailable rate always blocks finalise (see above).

### 4.5 `lead_financial_summaries` (read model, one row per lead)
Maintained in the same transaction as any finalise/verify/override. Holds `current_assessment_id`, totals in the reporting currency, `verified`, `as_of_date`, `finalised_at`, `is_stale`. It exists so filters, sorting, automations and the API read one indexed row instead of recomputing JSON. Built from the **final** assessment only: a half-typed draft never fires an automation or changes a filter.

## 5. Lead page — collect and view (mockup comes after approval)

New **Financials** record tab (flagged), in `Pages/Leads/Redesign/components/financials/`; shared money/segmented/badge pieces extended in `Components/Redesign/` first. Data via `Inertia::defer` + `<Deferred>`; `useLeadFinancialAssessment.ts` (+ small `useLeadAssessmentLine*` hooks) patch `LeadWorkspaceContext`; no Inertia reloads.

**View:** headline cards (Available now with override badge, Monthly income, Commitments, Disposable), a verified/stale/needs-proof status strip, lines grouped by kind with certainty chips and proof icons, "changed since previous assessment" deltas, assessment history timeline, plus a compact card on Overview.
**Collect:** (a) guided drawer opened from the tab or during a call, grouped by kind, pre-filled from the last final, add-line from the configurable type list; (b) inline row editing for quick fixes; (c) automatically from qualification mappings, API and forms (§6), which land in the open draft; finalise / verify / override as explicit actions.

Mockup deliverable (after approval): interactive HTML artifact showing the tab (empty / draft / final+verified / stale states), the guided collection drawer, line editor and history, built on the existing redesign tokens (`design-tokens.json`, `Button`, `Modal`, `Badge`).

## 6. Field catalog (external mappings)

Scope (D5): the **field catalog external services read and map against** — `GET api/lead-fields` — and its write path, `lead_fields` on `contact/create`. Qualification mappings and custom-field mapping targets are **out of scope** for now (the registry below makes them a small follow-up).

One `AssessmentFieldRegistry` builds descriptors per company from the **active kinds, types and crypto assets**, so a type an admin adds later shows up in the catalog with no deploy:
- **Writable line fields** `assessment.{type_key}` — `type: number`, `group: financial_assessment`, `write_modes: [fill, overwrite, append]`.
- **Read-only metrics** `assessment.metric.{available_now|income_monthly|commitments_monthly|disposable_monthly|assets_total|funding_total|verified|verified_at|age_days|status}` — `writable: false`, `write_modes: []`, listed so mappings and automations can be designed against them.

Required changes to the existing catalog code:
- `LeadFieldCatalog::all()/find()/byKey()` are cached under one global key and are not company-aware. Assessment descriptors are per company, so they are merged in **after** the cached column list (or the cache key is company-scoped); the endpoint reads `X-COMPANY-ID` like the other API controllers.
- Additive response keys on assessment fields only: `accepts` (`currency`, `frequency`, `certainty`, `available_from`, `note`) so a consumer knows the optional companions. Existing fields are unchanged, so current consumers are unaffected.
- `LeadFieldWriter::apply()` gets a branch for `assessment.*` keys. It keeps the existing contract: plain value **or** `{value, mode, currency?, frequency?, certainty?, available_from?, note?}`, unknown/invalid → `skipped_lead_fields` with the existing reason codes (`not_available`, `invalid_value`, `mode_not_supported`) plus `no_permission`/`assessment_locked`; the request never fails.
- Mode meaning for lines: `fill` = add only if the open draft has no line of that type; `overwrite` = replace that type's line(s) in the draft; `append` = add another line (e.g. a second bank account).
- Assessment writes go through `AssessmentService` into the lead's **open draft** (created on first write, `source: api`), never a finalised assessment, and they run in their own transaction because the existing writer only mutates the in-memory lead and lets the caller save. Metrics reject with `mode_not_supported`.
- Writes by an API client never finalise (D2: finalising is manual).

Not planned unless you ask (Q2): a value-read endpoint such as `GET api/leads/{id}/financial-assessments`. The catalog lets services see and map fields; it does not return a lead's data.

## 7. Automations
- `LeadFieldResolverService`: `financial_*` branch reading `lead_financial_summaries`.
- `AutomationFieldCatalog` + `builderFields.ts` + blade rows: financial group.
- New triggers: `financial_assessment_finalised`, `financial_assessment_verified`, `financial_assessment_stale` (scheduled daily). Exact trigger list/format checked in Phase 4 before adding.
- `changed` is native-column-only today; for financial values the finalise trigger plus "previous vs new" is the intended way, so I will **not** stretch `changed`.
- Email merge tags: financial fields are **condition-only** by default (same reasoning as the marketing PII chokepoint); opt-in per field later if wanted.
- Typical use: "stale > 90 days → create task: refresh assessment"; "available now ≥ X and verified → move lead / notify".

## 8. Filters
Keys (added to `LeadService` filter lists, `sanitizeFilterPayload`, saved views, facets and `leadFilterConfig.ts`): `fa_has` (any / none / stale), `fa_status`, `fa_verified`, `fa_available_now_min/max`, `fa_income_monthly_min/max`, `fa_disposable_min`, `fa_type[]` (has a line of type), `fa_certainty`, `fa_age_days_max`. Range filters hit the summary row; type filter is an `EXISTS` on current-final lines. Gated by `crm.leads-filter-v2` and the new flag. Optional list column + sort on available now. Export columns only for permitted users.

## 9. Cross-cutting
- **Permissions:** view / edit / finalise-verify-override as separate permissions; field-level hiding where the viewer lacks `view`.
- **Lead merge:** assessments follow the survivor; two current finals → survivor's stays current, the other becomes superseded history.
- **GDPR:** included in erasure/anonymisation; excluded from AI summaries unless allowed.
- **Timeline:** finalise / verify / override emit CRM events; edits are attributable (`prepared_by`, `verified_by`).
- **i18n:** `resources/lang/{eng,de,tr,ru}` + bump `I18N_DICT_VERSION`.

## 10. Phases (one PR each, behind the flag)
0. **Approve plan → mockup → approve mockup.**
1. Schema, models, enums, seeders, calculator, assessment service, FX freeze, settings UI for kinds/types. *Tests:* calculator, constraints, lifecycle.
2. Lead page Financials tab (view + collect), Overview card, hooks, i18n.
3. Field registry, company-aware extension of `LeadFieldCatalog`, `LeadFieldWriter` assessment branch, `CryptoRateService` + supported-asset settings.
4. Automations: resolver, catalog, builder UI, triggers, stale scheduler.
5. Filters: summary read model, filter keys, UI config, saved views, optional column/export.
6. Permissions, merge, GDPR, timeline, docs/CHANGELOG, rollout; verification (phpunit, Pint, PHPStan; no JS test runner exists, so browser check with the pre-installed Playwright).

## 11. Decisions

Resolved:
- **Q1** `verified_at` = when it was verified; `verified_by_user_id` = who. ✔
- **D2** Finalising is **always manual** (UI action only; API and qualification never finalise). ✔
- **D4** Crypto converted via a free exchange-data API (CoinGecko default). Needs an API key in env. ✔
- **D5** Catalog scope = `api/lead-fields` + `lead_fields` write path (§6). ✔
- **D6/D7** gRPC and the deal link are deferred. ✔
- **D8** Branch renamed to `feat/lead-financial-assessments`. ✔

Awaiting confirmation:
- **D1** "Additive" — see §1b; please confirm this is the reading you intend.
- **D3** Contributor = `contributor_label` + optional `contributor_lead_id` (default stands unless you object).
- **Q2** Do you want a value-read endpoint for a lead's assessment data, or is catalog-only enough?
- **Q3** Who provides the CoinGecko (or CoinMarketCap) API key for each environment?
