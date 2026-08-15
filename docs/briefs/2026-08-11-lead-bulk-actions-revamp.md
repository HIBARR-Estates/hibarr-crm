# Lead bulk actions revamp

**Date:** 2026-08-11  
**Repo:** hibarr-crm  
**Scope:** Leads Index bulk toolbar + `lead-contact.apply_quick_action` + modal UX aligned with the Lead Filter modal

---

## Goal

Bulk-updating leads today is basically “change category or delete.” Agents need to set the same **option-backed** fields they already edit on a single lead (source, owner, temperature, lifecycle status, WhatsApp group, etc.) in one pass. The bulk UI should feel like the Lead Filter workbench (pills / segmented / checklist), not a bare Ant Design Form + Select.

---

## TL;DR

| Piece | Exists today? | Where | Gap |
|-------|---------------|-------|-----|
| Bulk toolbar (select action → Apply) | Yes | [`BulkLeadActionSelector.tsx`](resources/js/Features/Leads/BulkActions/BulkLeadActionSelector.tsx) | Only Category + Delete (+ Merge when 2) |
| Bulk change category modal | Yes | [`BulkChangeCategory.tsx`](resources/js/Features/Leads/BulkActions/BulkChangeCategory.tsx) | Generic Ant modal; not filter-styled |
| Bulk API: category | Yes | [`LeadContactController::applyQuickAction`](app/Http/Controllers/LeadContactController.php) ~1321 | — |
| Bulk API: source | Yes | same, `change_source` | **No React UI** |
| Bulk API: owner | Yes | same, `change_owner` | **No React UI** |
| Bulk API: temperature / lifecycle / WA group / gender / salutation | No | — | Need new `action_type`s |
| Single-lead patch for those fields | Yes | [`PatchRequest`](app/Http/Requests/Lead/PatchRequest.php) + patch handler | Not bulk |
| Filter modal chrome + controls | Yes | [`LeadFilterModal.tsx`](resources/js/Features/Leads/Filters/LeadFilterModal.tsx), [`controls.tsx`](resources/js/Features/Leads/Filters/controls.tsx), [`lead-filter-modal.css`](resources/js/Features/Leads/Filters/lead-filter-modal.css) | Reuse controls + CSS tokens; don’t reuse filter state |
| Deal bulk pattern (one modal per action) | Yes | [`Features/Deals/BulkActions/`](resources/js/Features/Deals/BulkActions/) | Mirror flow; upgrade chrome to LFM style |

---

## Current state

### UI actions

[`BulkLeadActionSelector.tsx`](resources/js/Features/Leads/BulkActions/BulkLeadActionSelector.tsx):

```ts
const DEFAULT_LEAD_BULK_ACTIONS = [
    { label: "Change Category", value: "change_category" },
    { label: "Delete", value: "delete" },
];
// Merge appended only when merge access + exactly 2 selected
```

Wired from [`Pages/Leads/Index.tsx`](resources/js/Pages/Leads/Index.tsx) when rows are selected.

### Backend (`POST lead-contact/apply_quick_action`)

[`LeadContactController::applyQuickAction`](app/Http/Controllers/LeadContactController.php) (~1321–1377):

| `action_type` | Payload | Behavior | UI |
|---------------|---------|----------|-----|
| `change_category` | `category_ids[]` | `syncCategories` (replace) | Yes |
| `change_source` | `source_id` | mass `update` | No |
| `change_owner` | `lead_owner` | mass `update` | No |
| `delete` | — | `forceDelete` | Yes |

### Filter modal to match

[`LeadFilterModal`](resources/js/Features/Leads/Filters/LeadFilterModal.tsx) is a two-pane workbench:

- Ant `Modal` with `footer={null}`, class `lfm-modal`, zero body padding
- Header / body / footer using `.lfm-*` from [`lead-filter-modal.css`](resources/js/Features/Leads/Filters/lead-filter-modal.css) (REDESIGN_TOKENS restated for portal)
- Field controls from [`controls.tsx`](resources/js/Features/Leads/Filters/controls.tsx): `TemperatureCards`, `PillGroup`, `Segmented`, `CheckList`, `FieldShell`

Filter schema lives in [`leadFilterConfig.ts`](resources/js/configs/leadFilterConfig.ts) (`control` + `section` + options from Index props).

**Important:** filter controls are multi-select / “match any.” Bulk edit is **set value** (single choice, or multi-replace for categories). Same visuals, different selection semantics.

### Option fields worth bulk-updating

From lead info + filters + patch:

| Priority | Field | Key | Control to reuse | API today |
|----------|-------|-----|------------------|-----------|
| P0 | Category | `category_ids` | `PillGroup` (multi, replace) | `change_category` |
| P0 | Source | `source_id` | `PillGroup` (single) | `change_source` |
| P0 | Lead owner | `lead_owner` | `CheckList` (single) | `change_owner` |
| P0 | Temperature | `temperature` | `TemperatureCards` (single) | **new** |
| P0 | Lifecycle status | `lead_lifecycle_status_id` | `PillGroup` (single) | **new** |
| P1 | Joined WhatsApp group | `has_joined_the_whatsapp_group` | `Segmented` Yes/No | **new** (writes `lead_marketing`) |
| P2 | Gender | `gender` | `Segmented` / pills | **new** |
| P2 | Salutation | `salutation` | `PillGroup` (single) | **new** |

Skip for v1: free text, UTM, languages (awkward replace), currency/value, added-by, lead agent unless product still distinguishes it from owner.

---

## Proposed design

### One workbench modal, not N tiny modals

Replace “Choose action → Apply → separate Ant Form modal” with a **Bulk update** entry that opens one LFM-styled modal:

```
┌─ Bulk update · N contacts ──────────────────────────┐
│  [Reset]                                      [×]   │
├────────────┬────────────────────────────────────────┤
│ Categories │  FieldShell + PillGroup / …            │
│ Source     │  (only the active section’s control)   │
│ Owner      │                                        │
│ Temperature│                                        │
│ Status     │                                        │
│ WhatsApp   │                                        │
├────────────┴────────────────────────────────────────┤
│ Will set: Temperature → Hot          [Update N]     │
└─────────────────────────────────────────────────────┘
```

- Left rail = field sections (same pattern as filter sections)
- Right pane = **one field at a time** (avoids accidental multi-field writes)
- Footer = summary of the pending change + primary “Update N contacts”
- Keep **Delete** and **Merge** as separate toolbar actions (destructive / special-case)

Toolbar becomes something like:

- Bulk update… (opens workbench)
- Delete
- Merge (when eligible)

### Reuse, don’t fork

| Reuse | Don’t reuse |
|-------|-------------|
| `.lfm-*` CSS (shared or thin `lbm-*` alias importing same tokens) | `FilterContext` / draft URL filters |
| `FieldShell`, `PillGroup`, `TemperatureCards`, `Segmented`, `CheckList` | Filter multi-select semantics as-is |
| Index props options (`sources`, `temperatures`, `leadLifecycleStatuses`, `employees`, …) | Building new option lists from scratch |
| `lead-contact.apply_quick_action` | A second bulk endpoint |

Extend controls slightly if needed:

- `PillGroup` / `TemperatureCards`: optional `single` mode (or clear-others-on-select wrapper in the bulk modal)
- `CheckList`: already single-selectable if we pass max-one selection from the parent

### Config-driven fields

New small config (mirrors filter config shape, edit-oriented):

```ts
// e.g. resources/js/Features/Leads/BulkActions/bulkUpdateConfig.ts
{
  key: "temperature",
  label: "Temperature",
  section: "Classification",
  control: "temperature", // single
  actionType: "change_temperature",
  payloadKey: "temperature",
  options: props.temperatures,
}
```

Modal maps `actionType` + payload → existing `useApiMutate(route("lead-contact.apply_quick_action"))`.

### Backend extensions

Keep one switch in `applyQuickAction`. Add:

| `action_type` | Validation / write |
|---------------|-------------------|
| `change_temperature` | enum cold/warm/hot → `leads.temperature` |
| `change_lifecycle_status` | exists in company statuses → `lead_lifecycle_status_id` |
| `change_whatsapp_group` | boolean → `marketing()->updateOrCreate` (same as patch) |
| `change_gender` / `change_salutation` | enum → column |

Permission: apply the same `edit_lead` check used for patch (today quick action does **not** appear to re-check per-row edit access — call this out before ship; at minimum document, preferably gate by permission + skip inaccessible IDs).

Response: keep `Reply::success`; frontend `router.reload({ only: ["leads"] })` + clear selection (current category pattern).

### Semantics notes

- **Category:** keep replace-all (`syncCategories`) — copy must say so (already does).
- **Source / owner / status / temperature:** set (nullable clear only if product wants “Clear” — recommend explicit Clear button per field, not empty Apply).
- **WhatsApp group:** set true/false only (no “leave unchanged” once Apply is clicked — unused fields simply aren’t submitted).

---

## Work breakdown

### Backend

- [x] Extend `applyQuickAction` with temperature, lifecycle status, WhatsApp group (P0/P1)
- [x] Optional P2: gender, salutation — deferred
- [x] Validate option IDs/enums; return clear errors
- [x] Decide permission / per-row access behavior and implement
- [ ] Feature/unit tests for new action types (mirror existing category tests if any)

### Frontend

- [x] Add `bulkUpdateConfig.ts` (fields + controls + actionType mapping)
- [x] Build `BulkUpdateModal.tsx` using LFM layout + shared filter controls (single-select wrappers)
- [x] Wire `BulkLeadActionSelector`: “Bulk update” opens workbench; keep Delete/Merge
- [x] Retire or thin-wrap `BulkChangeCategory` into the workbench Categories section
- [x] Wire source + owner UI onto existing API actions
- [x] Shared CSS: reuse `lead-filter-modal.css` classes or extract shared `lfm` partial
- [x] Copy / `td()` for labels and footer summary
- [x] Success/error toasts + `router.reload({ only: ["leads"] })`

### Cleanup

- [x] Remove dead “Choose action → Change Category” path once workbench ships
- [x] Confirm Index still passes option props the modal needs (`sources`, `temperatures`, `leadLifecycleStatuses`, employees/owners)

---

## Open questions

1. **Single workbench vs. one modal per field?** Recommendation: one workbench (matches filter modal; fewer clicks). Confirm.
2. **Clearing values:** Should bulk update allow clearing source/owner/status (set null), or only set a new value?
3. **Permissions:** Skip unauthorized leads silently, fail the whole batch, or only show actions the user can always apply?
4. **P1/P2 scope for first PR:** Ship source + owner + temperature + lifecycle + WhatsApp in one PR, or split API-ready (source/owner) vs. new actions?
5. **Toolbar label:** “Bulk update” vs. keep a dropdown of actions that all open the same modal pre-focused on a section?

---

## Resolved decisions

1. **Workbench** — one LFM-styled Bulk update modal with a left rail of fields.
2. **Clearing** — yes; allow clearing (null / empty categories) for settable fields.
3. **Permissions** — only show toolbar actions the user can apply (`edit_lead` for Bulk update, `delete_lead` for Delete, existing merge gate). Backend filters to accessible leads.
4. **Scope** — ship category + source + owner + temperature + lifecycle + WhatsApp in this change.
5. **Toolbar** — primary control is **Bulk update** (not a long action dropdown); Delete / Merge stay separate.
6. **Select all** — means all leads matching current filters (`select_all_matching`), not the current page (header checkbox already covers the page).
7. **Multi-field** — workbench scrolls section-to-section like filters; one submit applies every touched field via `action_type=bulk_update`.
