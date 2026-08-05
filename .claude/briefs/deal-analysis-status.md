# Deal Analysis — Implementation Status Brief
**Date:** 2026-07-30  
**Scope:** `resources/js/Pages/Deals/Redesign/` (frontend) + Laravel backend

---

## What Was Asked For

Two features from the original audio brief:

### Feature 1: Deal Analysis Modal
A structured overlay on the deal page that lets agents fill in all deal and lead information in a guided, step-by-step flow.

**Key requirements (verbatim from brief):**
- Auto-opens on cold page load if analysis is **not completed** and **not minimized this session** (sessionStorage, not localStorage — clears on tab close)
- **Blurs/dims the deal page** in the background — the modal sits centered on top, not full-screen
- Modal is approximately **95vw × 90vh** — you should see the deal page blurred behind it
- **Lead information card always visible** at all times while the modal is open (name, email, phone pinned in the left panel)
- **Guided script navigation** — left nav with:
  - Custom field categories first (one nav item per category, progress %)
  - Divider
  - LEAD INFO at the bottom (single step combining all native + custom lead fields)
- **Back/forward (← / →) arrows** in the content area to move between steps
- **"Minimize"** button — stores `deal_analysis_minimized_{dealId}` in sessionStorage, modal does not reopen this session
- **"Mark as Complete"** button — warns if unfilled fields, then POSTs to backend
- **"Open Analysis"** button always accessible in the deal sticky header
- Tracks completion in DB: `analysis_status`, `analysis_completed_at`, `analysis_completed_by`
- Logs a `deal_analysis_completed` CRM event to the timeline on completion
- Does **not** replace or modify the existing `dealinfo` tab

### Feature 2: Deal Creation Revamp (NOT STARTED)
Make `pipeline_id` required when creating a new deal. The creation gathering form needs a pipeline selection step added as step 0.

---

## What Has Been Built (Feature 1)

### Database ✅ COMPLETE
- Migration: `database/migrations/2026_07_29_000001_add_analysis_fields_to_deals_table.php`  
  Adds `analysis_status` (string, default `'pending'`), `analysis_completed_at` (nullable timestamp), `analysis_completed_by` (unsignedInt FK → users, nullOnDelete)  
  Made idempotent (uses `Schema::hasColumn` guards + inline `ALTER TABLE MODIFY` for FK type fix)  
  **Successfully migrated.**
- `app/Models/Deal.php` — `$casts` includes `analysis_completed_at` → datetime, `analysis_completed_by` → integer

### Backend ✅ COMPLETE
- `app/Enums/DealUpdateType.php` — Added `LEAD_CUSTOM_FIELD = 'lead_custom_field'`
- `app/Services/DealGatheringService.php` — Extended `CONTACT` case to allow all native lead fields (`client_name`, `client_email`, `mobile`, `cell`, `office`, `company_name`, `salutation`, `gender`, `address`, `postal_code`, `city`, `state`, `country`, `source_id`); added `LEAD_CUSTOM_FIELD` case calling `$deal->contact->updateCustomFieldData($data)`
- `app/Http/Controllers/DealGatheringController.php` — Added `completeAnalysis()`: validates, checks permissions/lock, updates 3 DB columns, fires `DealActivityEventService::recordAnalysisCompleted()`, returns JSON
- `app/Services/DealActivityEventService.php` — Added `recordAnalysisCompleted(Deal $deal, string $completionType, int $unfilledCount)`
- `config/crm_events.php` — Added `deal_analysis_completed` event type (seeded successfully, 58 event types total)
- `routes/web.php` — `PATCH gathering/analysis-complete/{id}` → `DealGatheringController@completeAnalysis` → named `gathering.analysis_complete`
- `app/Http/Controllers/DealController.php` — `show()` now includes:
  - Synchronous: `analysis_status`, `analysis_completed_at`, `analysis_completed_by` on the deal prop
  - Deferred (group `formMeta`): `leadCustomFieldsData` and `leadCustomFields` via `contact->getCustomFieldsData()` / `getCustomFieldGroupsWithFields()`

### Frontend types ✅ COMPLETE
- `resources/js/Types/api/deals.ts` — `Deal` interface has `analysis_status?`, `analysis_completed_at?`, `analysis_completed_by?`
- `resources/js/Pages/Deals/Redesign/types.ts` — `DealShowProps` has `visibleLeadFieldKeys?`, `leadCustomFieldsData?`, `leadCustomFields?`

### Frontend hook ✅ COMPLETE
- `resources/js/Pages/Deals/Redesign/hooks/useDealAnalysis.ts`
  - sessionStorage key: `deal_analysis_minimized_{dealId}`
  - `isOpen` initializes from `!wasMinimized(deal.id) && !isCompleted`
  - `minimize()` → writes sessionStorage, sets `isOpen = false`
  - `open()` → clears sessionStorage, sets `isOpen = true`
  - `complete()` → PATCH to `gathering.analysis_complete`, on success patches `DealWorkspaceContext` deal state and closes
  - Returns: `{ isOpen, isCompleted, isCompleting, open, minimize, complete }`
  - Direct axios (not TanStack) to avoid v5 generic incompatibilities

### Frontend components — BUILT BUT NEED VISUAL REVIEW
All five components exist:

| File | Status |
|------|--------|
| `components/analysis/DealAnalysisModal.tsx` | Built, redesigned — **needs visual test** |
| `components/analysis/AnalysisStepNav.tsx` | Rebuilt to match DealInfoSidebar — **needs visual test** |
| `components/analysis/AnalysisStepContent.tsx` | Built — functional, needs visual test |
| `components/analysis/AnalysisLeadInfoStep.tsx` | Built — functional, needs visual test |
| `components/analysis/AnalysisFooter.tsx` | Built — functional, needs visual test |

### DealViewRedesign integration ✅ COMPLETE
- `DealViewRedesign.tsx` — `useDealAnalysis()` called once in `DealViewRedesignInner`, passed as prop to `<DealAnalysisModal analysis={analysis} ...>`
- `DealStickyHeader.tsx` — "Open Analysis" / "View Analysis" button added, uses `dr-btn dr-btn-ghost`

### CSS ✅ ADDED
- `deal-redesign.css` — Added `.analysis-modal-overlay` (fixed inset-0, z-1200, rgba(22,41,77,0.5) + blur backdrop, flex center, 2.5vh/vw padding) and `.analysis-modal-panel` (95vw × 90vh, border-radius 14px, border, shadow, flex column, overflow hidden)

---

## Current State of the Modal (After Last Redesign)

The modal has been significantly improved from the original broken state. Here is exactly what it does now:

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────┐  ← centered, 95vw × 90vh
│  Deal Analysis    Complete all fields to finalize...          [Minimize] │  ← header
├───────────────────┬─────────────────────────────────────────────────────┤
│ [Avatar] Lead Name│  Step Title                         [←] 2/5 [→]    │  ← content header
│ ✉ email           ├─────────────────────────────────────────────────────┤
│ ☎ phone           │                                                     │
│                   │   {Custom fields for this step}                     │  ← scrollable
│ DEAL INFORMATION  │                                                     │
│ • Category 1  50% │                                                     │
│ • Category 2  ✓   │                                                     │
│ ─────────────     │                                                     │
│ LEAD INFO         │                                                     │
│ • Lead Info   30% │                                                     │
└───────────────────┴─────────────────────────────────────────────────────┤
│  30 / 45 fields filled ████░░░░   [Minimize]   [Mark as Complete]       │  ← footer
└─────────────────────────────────────────────────────────────────────────┘
```

**What the redesign fixed:**
- Modal size: now `95vw × 90vh` centered with blurred backdrop (was `fixed inset-0` full screen)
- Lead card: now pinned in left nav, always visible (name + email + phone)
- Step order: categories first, lead info last below divider (was lead info first)
- Nav styling: `border-l-2` active state, group labels, progress badges — matches `DealInfoSidebar` exactly
- Navigation: ← / → arrows in content header with step counter
- Buttons: `dr-btn dr-btn-ghost dr-btn-sm` / `dr-btn-ghost` throughout
- `Minimize` button is duplicated — appears in both header and footer. Brief only specifies footer. **Remove from header footer.**

---

## Known Gaps / What Still Needs Doing (Feature 1)

### 1. Visual confirmation required — run `npm run v-dev` and test
The modal has never been visually tested in a browser. TypeScript compiles clean but the visual output is unverified. Specifically check:
- Does the backdrop blur actually show the deal page behind the modal?
- Does the lead card render correctly (avatar initials, email, phone)?
- Do the `dr-btn` classes render correctly (they rely on `.analysis-modal-panel` being in the right font-family context)?
- Does the `AnalysisStepNav` group label + divider + border-l-2 active state match `DealInfoSidebar`?
- Does step content scroll correctly when fields overflow?
- Does `AnalysisStepContent` filter to the correct category's fields? (it passes all `fields` + `categoryId` to `CustomFieldDisplay` — verify `CustomFieldDisplay` filters by `categoryId` internally)

### 2. `AnalysisStepContent` passes all fields, not pre-filtered
`AnalysisStepContent` passes the full `fields` array to `CustomFieldDisplay` along with `categoryId`. Confirm `CustomFieldDisplay` actually filters by `categoryId` internally. If it doesn't, each category step shows all fields. This needs a code trace into `CustomFieldDisplay`.

### 3. `Minimize` button duplication
`Minimize` appears in both the modal header and the footer (`AnalysisFooter`). Remove it from the header.

### 4. Auto-complete trigger missing
Brief says: when all fields are filled → trigger auto-complete. The footer shows a green "Mark as Complete" button when all filled, but does not automatically call `onComplete("auto", 0)`. Add a `useEffect` in the modal that watches `totalFilled === totalFields && totalFields > 0` and calls `analysis.complete("auto", 0)` once.

### 5. Empty state (no categories, no lead fields)
If `dealInfoCategories` is empty and `visibleLeadFieldKeys` produces 0 fields, the modal shows an empty left nav and blank content. Add an empty state message.

### 6. `deal.client_name` type safety
`DealAnalysisModal.tsx` casts `(deal as any).client_name`. The `deal` type in `DealWorkspaceContext` should include `client_name` explicitly. Check `DealWorkspaceContext.tsx` and add it to the interface if missing, to avoid the `any` cast.

---

## Feature 2: Deal Creation Revamp — NOT STARTED

### What's needed
Make `pipeline_id` required at deal creation time. The creation flow lives in `DealInformationGatheringForm` (somewhere under `resources/js/Features/Deals/DealInformationGathering/` or similar).

### Backend changes needed
- `DealGatheringController::init()` — when `$existingDeal` is null (new deal), `pipeline_id` must be required, not nullable
- `DealGatheringService::initializeDeal()` — remove the `?? 1` fallback so missing pipeline_id fails loudly

### Frontend changes needed
- Add a `PipelineStep.tsx` component — shows a list/grid of available pipelines for the user to pick
- Insert it as step 0 of `DealInformationGatheringForm` with `stepOffset` adjustment
- The existing gathering form's step numbering must shift by 1

### Pipelines data availability
Pipelines are already available as page props on the deals index page. Confirm they are passed through to the gathering modal or fetch them via the `getSteps` endpoint which already accepts `pipeline_id`.

---

## Files Changed (Complete List)

### New files
- `database/migrations/2026_07_29_000001_add_analysis_fields_to_deals_table.php`
- `resources/js/Pages/Deals/Redesign/hooks/useDealAnalysis.ts`
- `resources/js/Pages/Deals/Redesign/components/analysis/DealAnalysisModal.tsx`
- `resources/js/Pages/Deals/Redesign/components/analysis/AnalysisStepNav.tsx`
- `resources/js/Pages/Deals/Redesign/components/analysis/AnalysisStepContent.tsx`
- `resources/js/Pages/Deals/Redesign/components/analysis/AnalysisLeadInfoStep.tsx`
- `resources/js/Pages/Deals/Redesign/components/analysis/AnalysisFooter.tsx`

### Modified files
- `app/Models/Deal.php` — `$casts` additions
- `app/Enums/DealUpdateType.php` — `LEAD_CUSTOM_FIELD` case
- `app/Services/DealGatheringService.php` — CONTACT + LEAD_CUSTOM_FIELD update handlers
- `app/Services/DealActivityEventService.php` — `recordAnalysisCompleted()`
- `app/Http/Controllers/DealGatheringController.php` — `completeAnalysis()` method
- `app/Http/Controllers/DealController.php` — analysis fields on deal prop + deferred lead custom field props
- `config/crm_events.php` — `deal_analysis_completed` event type
- `routes/web.php` — `gathering/analysis-complete/{id}` route
- `resources/js/Types/api/deals.ts` — analysis fields on Deal interface
- `resources/js/Pages/Deals/Redesign/types.ts` — lead field props on DealShowProps
- `resources/js/Pages/Deals/Redesign/DealViewRedesign.tsx` — modal integration + hook call
- `resources/js/Pages/Deals/Redesign/components/header/DealStickyHeader.tsx` — "Open Analysis" button
- `resources/js/Pages/Deals/Redesign/deal-redesign.css` — `.analysis-modal-overlay` + `.analysis-modal-panel`

---

## Immediate Next Steps (Priority Order)

1. **Run `npm run v-dev` and open a deal page** — the modal should auto-open on cold load for any deal with `analysis_status = 'pending'`. Visually verify everything in the "Visual confirmation required" section above.
2. **Trace `CustomFieldDisplay` `categoryId` filtering** — confirm each category step only shows that category's fields.
3. **Fix `Minimize` duplication** — remove it from `DealAnalysisModal` header (keep only in `AnalysisFooter`).
4. **Add auto-complete trigger** — `useEffect` watching `totalFilled === totalFields`.
5. **Type-safe `client_name`** — add to the deal interface in `DealWorkspaceContext.tsx` instead of `as any`.
6. **Feature 2** — after Feature 1 is visually confirmed working.
