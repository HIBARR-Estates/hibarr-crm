# Lead financial assessments — plan of action

Status: **Mockup approved. Phases 1-2 built (see §12, §13); Phases 3-6 not started.**
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
| Mapped fields → API | `Services/LeadFieldCatalog` served by `GET api/lead-fields`; written through `lead_fields` on `contact/create` by `LeadFieldWriter`. Also `Qualification\LeadFieldCatalog` + `QualificationLeadFieldWriter` + `QualificationFieldMapping`, and `CustomFieldMapping\DefinedFieldRegistry` + `CustomFieldValueConverter` | **All three are targets (D5).** Each is column/allow-list driven, and the public catalog's cache is **not per-company**, so assessment fields (per-company config, not columns) need company-aware extensions (see §6) |
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

Mockup (published, 7 boards, private): https://claude.ai/artifact/MT7kaadwQst5mfW8kL7L7t — view, empty/auto-draft, guided collection drawer, review and finalise, history/compare, overview card + list filters + automation + field catalog, settings. Original brief: interactive HTML artifact showing the tab (empty / draft / final+verified / stale states), the guided collection drawer, line editor and history, built on the existing redesign tokens (`design-tokens.json`, `Button`, `Modal`, `Badge`).

## 6. Mapped fields (catalog, qualification, custom-field mapping, read API)

One `AssessmentFieldRegistry` builds descriptors per company from the **active kinds, types and crypto assets**, so a type an admin adds later shows up in every surface below with no deploy:
- **Writable line fields** `assessment.{type_key}` (a money amount; companions below).
- **Read-only metrics** `assessment.metric.{available_now|income_monthly|commitments_monthly|disposable_monthly|assets_total|funding_total|verified|verified_at|age_days|status}`.

All writers go through `AssessmentService` into the lead's **open draft** (created on first write) and **never finalise** (D2). A finalised assessment is never written to.

### 6a. Public field catalog — `GET api/lead-fields` + `lead_fields` on `contact/create`
- `LeadFieldCatalog::all()/find()/byKey()` are cached under one global key and are not company-aware. Assessment descriptors are merged in **after** the cached column list (the endpoint reads `X-COMPANY-ID` like the other API controllers).
- Line fields: `type: number`, `group: financial_assessment`, `write_modes: [fill, overwrite, append]`. Metrics: `writable: false`, `write_modes: []`.
- Additive response key on assessment fields only: `accepts` (`currency`, `frequency`, `certainty`, `available_from`, `note`). Existing fields and consumers are unchanged.
- `LeadFieldWriter::apply()` gets an `assessment.*` branch keeping the existing contract: plain value **or** `{value, mode, currency?, frequency?, certainty?, available_from?, note?}`; failures go to `skipped_lead_fields` with the existing codes (`not_available`, `invalid_value`, `mode_not_supported`) plus `no_permission`/`assessment_locked`; the request never fails.
- Modes: `fill` = add only if the draft has no line of that type; `overwrite` = replace that type's line(s) in the draft; `append` = add another (e.g. a second bank account).
- Runs in its own transaction (the existing writer only mutates the in-memory lead and lets the caller save). `source: api`.

### 6b. Qualification mappings
- `Qualification\LeadFieldCatalog::fields($companyId)` adds a **Financial assessment** group of `assessment.{type_key}` entries (no fixed option list).
- `QualificationFieldMapping` gains a nullable `target_options` JSON column holding the per-mapping companions (`currency`, `frequency`, `certainty`, `available_from`); the mapping UI (`Pages/Leads/QualificationMapping`) shows those controls when an assessment target is picked.
- `QualificationLeadFieldWriter::apply()` gets an assessment branch inside the existing try/catch, so a bad mapping can never fail the call. Answer → amount: parse the numeric answer; for choice answers `option_map` values are read as amounts (e.g. "€5–10k" → 7500). Unparseable → skipped and logged.
- Write modes: `overwrite` updates the draft's line (including a line carried forward from the last final — a new answer is newer information, so this is the expected setting); `fill_empty` writes only when the lead has **no** line of that type in the draft or the current final.
- `source: call`. Never finalises.

### 6c. Custom-field mapping (`DefinedFieldRegistry`)
- New store `STORE_ASSESSMENT_LINE` and value kind `KIND_AMOUNT`; one target per active type (`assessment.{type_key}`, label "Financial · Salary"), **Lead → Lead and Deal → Lead only** (assessments are lead-owned, so there is no Deal target). Deal → Lead keeps its existing "most recent deal's value wins" rule.
- `CustomFieldValueConverter::toDefinedField()` gets a `KIND_AMOUNT` branch reusing its numeric normaliser; the run request must supply `currency`, `frequency`, `certainty` for the target (no guessing); unconvertible values are reported as losses exactly like today.
- Deviation from the registry's own rule ("plain columns only, no money"): allowed because the value never touches a column — it goes through `AssessmentService`, and the settings page is already admin-only. The dry run uses the identical resolution and skips only the write, as today.
- Writes create **drafts** (`source: import`). Drafts fire no automations and affect no filters, so a bulk run is safe — but someone has to finalise each (see Q4).

### 6d. Read API (needed by external services)
- `GET api/leads/{leadId}/financial-assessments` (list: id, status, as_of_date, source, verified_at, totals), `GET …/current`, `GET …/{id}` (lines with type/kind key+label, amount, currency, converted amount, frequency, certainty, available_from, contributor; frozen totals incl. rates).
- Gated by a **new API token scope** (`financial_assessments:read`, registered in `config/api-token-scopes.php` after checking how `ApiTokenScopeService` enforces scopes) — financial data is not covered by the existing lead scopes. Company-scoped via `X-COMPANY-ID` like the other endpoints. Read only; writes stay on the catalog path.

### 6e. Configuration / env
Provider keys are read from env only (never committed): `CRYPTO_RATE_PROVIDER` (default `coingecko`), `COINGECKO_API_KEY`, `COINMARKETCAP_API_KEY` — wired in `config/services.php` and listed in `.env.example` (done). **You add the real values to each environment.**

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
3. Field registry; public catalog + writer (6a); qualification mapping target (6b, incl. `target_options` migration + mapping UI); custom-field mapping target (6c); read API + token scope (6d); `CryptoRateService` + supported-asset settings.
4. Automations: resolver, catalog, builder UI, triggers, stale scheduler.
5. Filters: summary read model, filter keys, UI config, saved views, optional column/export.
6. Permissions, merge, GDPR, timeline, docs/CHANGELOG, rollout; verification (phpunit, Pint, PHPStan; no JS test runner exists, so browser check with the pre-installed Playwright).

## 11. Decisions

Resolved:
- **Q1** `verified_at` = when it was verified; `verified_by_user_id` = who. ✔
- **D1** "Additive" as defined in §1b. ✔
- **D2** Finalising is **always manual** (UI only; API, qualification and imports never finalise). ✔
- **D3** Contributor = `contributor_label` + optional `contributor_lead_id`. ✔
- **D4** Crypto via a free exchange-data API (CoinGecko default); keys supplied by you in env. ✔
- **D5** Targets: public catalog + `lead_fields`, **qualification mappings and custom-field mapping** (§6). ✔
- **Q2** A read API is required (§6d). ✔
- **D6/D7** gRPC and the deal link are deferred. ✔
- **D8** Branch is `feat/lead-financial-assessments`. ✔

Open:
- **Q4** Custom-field mapping creates drafts, each needing a manual finalise. For a large backfill that is impractical. Options: (a) drafts only, finalised one by one *(default)*; (b) an explicit admin checkbox on the mapping run, "finalise as part of this import" (still a deliberate manual admin action; freezes FX per assessment; fails the lead on missing rates).

## 12. Phase 1 as built

Scope delivered: schema, enums, models, default seeding, calculator, fiat + crypto rates, assessment service, summary read model, and the lead-settings tab for kinds, types, crypto assets and defaults. Behind `crm.lead-financial-assessments` (off by default).

Calculation rules that the plan left open, now fixed in `AssessmentCalculator` (CALC_VERSION 1) and covered by tests that reproduce the mockup's figures exactly:
- **Commitments count at every certainty** (an uncertain obligation is still an obligation). Uncertain **income** is reported as `uncertain_income_monthly` and never summed in.
- **Asset and funding lines ignore frequency** (they are a stock). One-off *income* is not recurring, so it is left out of `income_monthly`.
- `available_projected` = confirmed + likely assets and funding, regardless of date; `uncertain_total` = uncertain assets and funding.
- Each line is converted and rounded to cents before summing, so displayed lines add up to the totals.
- The mockup's funding header showed €210,000 (counted + uncertain). The data model keeps them apart (`funding_total` 180,000, uncertain 30,000), so Phase 2 should show "counted · uncertain" rather than one sum.

Deviations from the plan and mockup, all small:
- The settings screen is a **tab on the existing Leads settings hub** (deferred, flag-gated) rather than a separate page. The "new kind" form stays inline, as in the mockup. Reorder is not built yet (types sort by creation order).
- Kinds, types and crypto assets have **no soft delete** (they are deactivated), so no `deleted_at` on those three tables.
- The `lead_financial_summaries` table is created now, because finalise and verify maintain it; filters and automations read it in Phases 4-5.
- Reporting-currency choices are the company's **fiat** currencies only; the app's currency list can also hold cryptocurrencies.
- A 3-letter currency code is accepted when a line is entered and, if it has no ECB rate (or is a disabled crypto ticker), finalise stops with the missing currency named. Longer tickers (e.g. USDT) must be an enabled crypto asset.

Environment note: crypto rates need `COINGECKO_API_KEY` (or `COINMARKETCAP_API_KEY` with `CRYPTO_RATE_PROVIDER=coinmarketcap`) in each environment. The settings tab shows whether the key is set and has a "Test rate fetch" button.

## 13. Phase 2 as built (Financials tab on the lead page)

Delivered behind `crm.lead-financial-assessments`: the Financials record tab (view, empty and draft-banner states, history and compare), the guided collection drawer, review-and-finalise, verify, and a snapshot card on Overview.

How it works:
- **One payload, one source of truth.** `AssessmentPresenter::workspace()` builds everything the tab needs (summary, current final, open draft with carried/edited/new markers and indicative totals, history, vocabulary, settings). `GET lead-contact/{lead}/financial` returns it, and every mutation returns the same payload, so the page swaps local state (`useLeadFinancials`, held in `LeadWorkspaceContext`) with no Inertia reload. The first load is a background request and never blocks first paint.
- **Actions are queued, not dropped.** A field saved on blur followed straight away by another edit both reach the server, in order.
- **Drafts show live indicative totals and rates** (`AssessmentService::preview()`); nothing is frozen or saved until finalise. A missing crypto rate blocks finalising and the modal offers Retry or a manual rate, as designed.
- **Shared layer:** a new `Drawer` primitive in `Components/Redesign/primitives`, built on `ModalShell` (same overlay, scroll lock, Escape and focus handling) with a small block in `redesign.css`.

Deviations and limits to know about:
- **Permissions:** reading needs `view_lead`, every change (including finalise and verify) needs `edit_lead`. The finer financial permissions (view / edit / finalise-verify-override) are still Phase 6.
- **Proof documents** are chosen from the lead's existing files; uploading from inside the drawer is not built (the drawer says so).
- **Compare** is a wide dialog rather than a full page board; the trend chart is a small inline SVG.
- **Not claimed yet:** the empty state no longer lists capture by qualification answers or website form (Phase 3), and the finalise dialog does not say filters/automations/API use the figures (Phases 4-5). Add that copy when those ship.
- Reordering and an in-drawer "manage kinds and types" link are not built.
