# Lead Bulk Export (field-selectable CSV / XLSX)
**Date:** 2026-08-11  
**Scope:** hibarr-crm — Leads index bulk toolbar + Laravel export endpoint  
**Status:** Design brief (not implemented)

---

## Goal

Add an **admin-gated bulk action** on the modern Leads index that exports the current selection (explicit row IDs **or** all leads matching active filters) to **CSV or XLSX**, with a UI so the user can pick which lead fields become columns.

---

## TL;DR

| Piece | Already exists? | Where | New work? |
|-------|-----------------|-------|-----------|
| Bulk toolbar + dual target (`ids` / `all_matching`) | Yes | [`BulkLeadActionSelector.tsx`](resources/js/Features/Leads/BulkActions/BulkLeadActionSelector.tsx), [`bulkTarget.ts`](resources/js/Features/Leads/BulkActions/bulkTarget.ts) | Wire a new Export action |
| Filter-aware ID resolution | Yes | [`LeadService::getMatchingLeadIds`](app/Services/LeadService.php:134) + [`resolveBulkLeadIds`](app/Http/Controllers/LeadContactController.php:1394) | Reuse for export row set |
| Maatwebsite Excel + sync download | Yes | `maatwebsite/excel` ^3.1; [`PropertyExport`](app/Exports/PropertyExport.php); [`PropertyController::exportProperties`](app/Http/Controllers/PropertyController.php:1461) | New `LeadExport` class |
| Hidden form POST download pattern | Yes | [`ExportProperties.tsx`](resources/js/Features/Properties/ExportProperties.tsx:14) | Copy for leads (payload differs) |
| Export permission helper | Yes | [`canDataTableExport()`](app/Helper/start.php:1149) = admin **or** (employee + company flag) | Decide: strict admin vs this helper |
| Legacy lead Excel (fixed columns) | Yes | [`LeadContactDataTable`](app/DataTables/LeadContactDataTable.php:271) Yajra buttons | Do **not** extend — wrong UI surface |
| Column-checkbox export UI | **No** | Property [`ExportModal`](resources/js/Components/Common/ExportModal.tsx) is filters-only | **New** modal |
| Modern lead bulk export endpoint | **No** | No `LeadExport` / no `lead-contact.export` | **New** route + controller method |
| Queued / async export | **No** | All exports sync today | Keep sync unless volume forces queue |

---

## Current state

### 1. Bulk selection (reuse as-is)

The Leads index already supports:

1. Checkbox selection across pages (`useGenericTableRowSelection` + `Leads/Index.tsx`)
2. **"Select all matching"** → `selectAllMatching: true` when `matchingTotal > selected count`
3. Payload contract via [`buildBulkTargetPayload`](resources/js/Features/Leads/BulkActions/bulkTarget.ts):

```ts
// ids mode
{ row_ids: "1,2,3" }

// all_matching mode — filters come from URL query, merged by caller
{ select_all_matching: true }
```

Delete / bulk update already merge `getCurrentQueryParams()` into the POST body and strip `page` / `per_page`. Export must do the same so “all matching” equals the filtered list.

Server resolution already lives in [`LeadContactController::resolveBulkLeadIds`](app/Http/Controllers/LeadContactController.php:1394):

- `select_all_matching` → `LeadService::getMatchingLeadIds($request)` (applies `view_lead` scope + `applyFilters`)
- else parse `row_ids`
- then per-ID permission re-check for edit/delete (export should use `view_lead` instead)

Today’s bulk actions are gated by `edit_lead` / `delete_lead` / `merge_lead` — **not** admin. Export is the first bulk action that needs a different gate.

### 2. Existing export stack

- **Package:** `maatwebsite/excel` ^3.1 (PhpSpreadsheet under the hood); writers for xlsx **and** csv are configured in [`config/excel.php`](config/excel.php).
- **Best template:** [`PropertyExport`](app/Exports/PropertyExport.php) — `FromCollection` + `WithHeadings` + `WithMapping`, constructor takes filters, controller returns `$this->excel->download(...)`.
- **Frontend download:** create a hidden `<form method="POST">`, attach CSRF + fields, `form.submit()` ([`ExportProperties.tsx`](resources/js/Features/Properties/ExportProperties.tsx:14–52)). Axios/JSON cannot trigger a file download cleanly for this pattern.
- **Legacy lead Excel:** Yajra DataTables button on Blade list, fixed columns (name, email, mobile, owner, addedBy, createdOn), gated by `canDataTableExport()`. Not usable from the React bulk toolbar.
- **No column picker exists anywhere** — property export only picks filters; columns are hard-coded.

### 3. “Admin only” vs what the product already does for export

User ask: **admin only**.

Repo precedent for exports:

```php
// app/Helper/start.php:1149
function canDataTableExport() {
    return in_array('admin', user_roles())
        || (company()->employee_can_export_data && in_array('employee', user_roles()));
}
```

Hard admin role checks elsewhere use `user()->hasRole('admin')` / `useIsAdminRole()` (e.g. timeline event management).

There is **no** `export_lead` permission in the permissions catalog.

**Open decision:** strict `hasRole('admin')` (matches the ask literally) vs `canDataTableExport()` (matches every other spreadsheet export in the product, including the legacy lead DataTable).

### 4. Field inventory for the picker

| Source | Good for |
|--------|----------|
| [`leadInfoSections.ts`](resources/js/Pages/Leads/Redesign/config/leadInfoSections.ts) `leadField` keys | Native contact / profile / address |
| [`LEAD_TABLE_COLUMNS`](resources/js/Features/Leads/Columns/index.tsx) | Sensible **defaults** (name, contact, source, category, lifecycle, temperature, owner, created) |
| [`bulkUpdateConfig.ts`](resources/js/Features/Leads/BulkActions/bulkUpdateConfig.ts) | Assignment fields (owner, source, categories, temperature, lifecycle, WhatsApp) |
| [`dossierSections.ts`](resources/js/Pages/Leads/Redesign/config/dossierSections.ts) | Marketing / engagement extras |
| [`CustomField::exportCustomFields(Lead::class)`](app/Models/CustomField.php:125) | Custom fields already flagged `export` / `visible` (legacy DataTable already uses this) |

Relation-backed columns (source name, owner name, category names, lifecycle label) need eager loads + mapping — same idea as PropertyExport’s mapping, not raw FK IDs in the sheet.

---

## Proposed design

```
[Leads Index selection]
        │
        ▼
 BulkLeadActionSelector ── Export (admin / canExport) ──► BulkExportLeads modal
        │                                                    │
        │  field checkboxes + format: csv | xlsx             │
        │  buildBulkTargetPayload + URL filters              │
        ▼                                                    ▼
 POST /account/lead-contact/export  (form submit, CSRF)
        │
        ├─ abort unless export gate
        ├─ resolve IDs (row_ids | select_all_matching + filters + view_lead scope)
        ├─ validate selected field keys against allowlist
        └─ Excel::download(new LeadExport($ids, $fields), filename, writerType)
```

### Backend

1. **Route** under the existing `account` + `auth` group, e.g.  
   `POST lead-contact/export` → `lead-contact.export` → `LeadContactController@export`  
   (Do **not** overload `apply_quick_action` — that returns JSON toasts; export needs a file response.)

2. **`LeadContactController::export(Request $request)`**
   - Gate: see open question (admin vs `canDataTableExport`)
   - Also require `view_lead !== 'none'`
   - Resolve IDs via shared helper (extract `resolveBulkLeadIds` to accept permission name, or a dedicated `resolveExportLeadIds` that uses `view_lead`)
   - Validate:
     - `fields` — array of allowlisted keys, min 1
     - `format` — `csv` | `xlsx`
     - target: `row_ids` XOR `select_all_matching`
   - Soft cap (recommended): abort/400 if resolved count > N (e.g. 5–10k) with a clear message — sync download will otherwise time out / OOM
   - Return Maatwebsite download with writer type from format

3. **`App\Exports\LeadExport`**
   - Constructor: `array $leadIds`, `array $fieldKeys`
   - `collection()`: `Lead::with([...needed relations...])->whereIn('id', $leadIds)` (+ marketing / custom field data if selected)
   - `headings()` / `map()`: driven by `$fieldKeys` + a PHP field registry (label + value resolver)
   - Preserve column order as requested by the client

4. **Server-side field allowlist** (single source of truth in PHP; frontend config mirrors labels/keys). Example groups:

   - Core: `id`, `client_name`, `salutation`, `client_email`, `mobile`, `office`, `client_whatsapp`, `client_telegram`, `client_instagram`, `company_name`, …
   - Profile / address: `gender`, `date_of_birth`, `nationality`, `occupation`, `languages`, `temperature`, address fields
   - Relations (resolved to display names): `source`, `categories`, `lead_owner`, `added_by`, `lifecycle_status`
   - Meta: `created_at`, `updated_at`
   - Optional marketing: UTMs, WhatsApp/FB/webinar flags, `contact_score`
   - Optional custom: `cf_{id}` — only fields returned by `CustomField::exportCustomFields(Lead::class)` (or all visible lead CFs — open question)

### Frontend

1. **`BulkExportLeads.tsx`** modal  
   - Shows target count (“Export 12 selected” / “Export 1,240 matching”)
   - Checkbox groups for fields (Select all / Reset to defaults)
   - Format radio: CSV / XLSX
   - Submit → hidden form POST to `lead-contact.export` with:
     - `buildBulkTargetPayload(target)`
     - current filter query params (same as delete)
     - `fields[]` / repeated `fields` inputs
     - `format`

2. **`exportFieldConfig.ts`**  
   - Hook-free list of `{ key, label, group, defaultSelected }`  
   - Labels English source strings; wrap with `td()` at render  
   - Defaults from table-column set

3. **`BulkLeadActionSelector`**  
   - Add `export` to action union  
   - Gate with `useIsAdminRole()` **or** a small `useCanExport()` wrapping the same rule as the server  
   - Mount `BulkExportLeads` like the other modals  
   - Export is allowed in both `ids` and `all_matching` modes (unlike merge)

4. **Custom fields in the picker**  
   - If included: load definitions from existing form-data / lead custom-fields endpoint (or pass a lean list on the index page). Keep out of v1 if we want the smallest ship.

### Auth recommendation (default until decided)

Implement **strict admin** as requested (`hasRole('admin')` / `useIsAdminRole()`), and note in code that product-wide export elsewhere uses `canDataTableExport()`. Easy to widen later by swapping one helper.

---

## Work breakdown

### Backend
- [ ] Add `POST account/lead-contact/export` route + `LeadContactController::export`
- [ ] Extract/reuse ID resolution with `view_lead` (not edit/delete)
- [ ] Add `App\Exports\LeadExport` with dynamic headings/mapping from allowlisted field keys
- [ ] PHP field registry (key → label + value resolver + required eager loads)
- [ ] Validate `format` ∈ {csv,xlsx}; map to Maatwebsite writer type
- [ ] Enforce export gate + optional max-row guard
- [ ] (Optional) Include custom fields via `CustomField::exportCustomFields`

### Frontend
- [ ] `exportFieldConfig.ts` — field groups + defaults
- [ ] `BulkExportLeads.tsx` — field picker + format + form POST download
- [ ] Wire Export into `BulkLeadActionSelector` (admin gate)
- [ ] (Optional) Fetch custom-field defs into the picker

### Tests / QA
- [ ] Feature test: non-admin 403; admin download 200 with expected headers
- [ ] Feature test: `select_all_matching` + filter returns same ID set as `getMatchingLeadIds`
- [ ] Feature test: unknown field key rejected; empty fields rejected
- [ ] Manual: CSV opens in Excel/Sheets; XLSX opens; relation columns show names not raw IDs

---

## Open questions

1. **Gate:** strict `admin` role only (as asked), or `canDataTableExport()` (admin **or** employee when `employee_can_export_data` is on — matches legacy lead Excel and reports)?
2. **Custom fields in v1?** Include CF columns (respecting the existing `export` flag), or native + marketing only first?
3. **Marketing / UTM columns in v1?** Nice for growth ops; adds relation + mapping work.
4. **Max rows for sync download?** Suggested hard cap (e.g. 5,000 or 10,000) with a toast — or leave uncapped like PropertyExport?
5. **Default selected fields:** table columns only, or a broader “common contact” set?
6. **Filename convention:** `leads-export-YYYY-mm-dd-HH-ii-ss.xlsx` (match properties) OK?

---

## Out of scope (unless requested)

- Replacing / removing the legacy Yajra Excel button on Blade lead lists
- Queued email delivery of large exports
- Import symmetry / export templates for re-import
- Per-permission `export_lead` in the RBAC matrix (would be a separate product decision)
