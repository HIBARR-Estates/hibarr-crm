# List & settings product tours

**Date:** 2026-09-02  
**Scope:** `hibarr-crm` — tasks list (redesign), lead list, deal list, Preferences, Reminder preferences  
**Pattern:** Mirror Lead/Deal **detail** tours (`ProductTour` + per-page `*TourSteps.ts` + `t()` keys). One flag for all five.

This brief is the implementation source of truth. The CRM task can link here; do not fork a second spec.

---

## How to use this brief

Prompt against **one phase at a time**. Do not implement a later phase until the previous one is built. Do **not** run Phase 6 until Phases 0–5 are done. Do **not** enable the flag in production from this brief.

| Prompt | What to do |
|--------|------------|
| Implement Phase 0 of `.claude/briefs/list-product-tours.md` | Shared flag + Replay guide on list headers |
| Implement Phase 1 of `.claude/briefs/list-product-tours.md` | Tasks list tour (redesign only) |
| Implement Phase 2 of `.claude/briefs/list-product-tours.md` | Lead list tour |
| Implement Phase 3 of `.claude/briefs/list-product-tours.md` | Deal list tour |
| Implement Phase 4 of `.claude/briefs/list-product-tours.md` | Preferences tour |
| Implement Phase 5 of `.claude/briefs/list-product-tours.md` | Reminder preferences tour |
| Run Phase 6 of `.claude/briefs/list-product-tours.md` | Validation / verification only |

Each of Phases 0–5 is **implementation only** (files, attrs, copy keys, wiring). Phase 6 is the only verification gate.

English title/body in the step tables below is the copy source of truth. Put those strings in `resources/lang/eng/pages.php` under the namespace given for that phase; add de / ru / tr in the same phase (same keys, translated). Do not use `td()` for tour chrome or steps.

---

## Goal

Ship first-visit spotlight tours on five surfaces that currently have none, teaching what each region is for and how to use it — without blocking work when a control is missing (permission, empty chip, feature-gated section). Missing `data-tour` targets are auto-skipped by the engine.

## Locked decisions

- All five tours ship as one piece of work; execute via the phases below.
- One flag for all five: **`crm.list-product-tours`**. Register in [`config/features.php`](config/features.php) `known_flags`. Default **off** until ops enable it.
- Replay is a ghost **Replay guide** control in the page header. Omit entirely when the flag is off (same rule as lead `MoreMenu` / deal `DealActionsMenu`). Label wording: `Replay guide` (same as detail `replay_menu_item`).
- Reuse [`ProductTour`](resources/js/Components/ProductTour/ProductTour.tsx) + [`useProductTour`](resources/js/Components/ProductTour/useProductTour.ts) + `POST product-tours.seen`. Do not fork the engine. Change the engine only if a list/settings target is broken (e.g. top-bar search).
- Distinct `tourId`s so list ≠ detail, and pages do not share seen-state.
- Tasks tour mounts only on [`TasksWorkspaceRedesign`](resources/js/Pages/Tasks/Redesign/TasksWorkspaceRedesign.tsx). Legacy tasks index is **out of scope**.
- Copy is static `t()` keys, matching deals/leads detail. English in this brief; de/ru/tr at implementation time.

## TL;DR

| Piece | Exists? | Where |
|-------|---------|--------|
| Shared tour engine | Yes | [`ProductTour.tsx`](resources/js/Components/ProductTour/ProductTour.tsx) |
| Seen-state (server + local) | Reuse | `product-tours.seen`, `UserProductTour`, `auth.user.seen_product_tours` |
| Detail consumers (do not change) | Yes | [`dealTourSteps.ts`](resources/js/Pages/Deals/Redesign/config/dealTourSteps.ts) (`deal-redesign-v1`), [`leadTourSteps.ts`](resources/js/Pages/Leads/Redesign/config/leadTourSteps.ts) (`lead-redesign-v1`, flag `crm.leads-product-tour`) |
| List/settings flag, Replay, five consumers | **New** | this brief |

| Surface | Page | `tourId` | Lang namespace |
|---------|------|----------|----------------|
| Tasks list | `TasksWorkspaceRedesign` | `tasks-list-v1` | `pages.tasks.tour` |
| Lead list | [`Leads/Index.tsx`](resources/js/Pages/Leads/Index.tsx) | `leads-list-v1` | `pages.leads.list_tour` |
| Deal list | [`Deals/Index.tsx`](resources/js/Pages/Deals/Index.tsx) | `deals-list-v1` | `pages.deals.list_tour` |
| Preferences | [`Preferences.tsx`](resources/js/Pages/Settings/Preferences.tsx) | `preferences-v1` | `pages.settings.preferences_tour` |
| Reminder preferences | [`ReminderPreferences.tsx`](resources/js/Pages/Settings/ReminderPreferences.tsx) | `reminder-preferences-v1` | `pages.settings.reminder_preferences_tour` |

Keep existing `pages.leads.tour` and `pages.deals.tour` for **detail** tours. Do not overwrite them.

## Shared rules

1. **Reuse the engine.** Each page: `tourId` + `steps` + `labels` (translation keys). Mirror [`buildLeadTourSteps`](resources/js/Pages/Leads/Redesign/config/leadTourSteps.ts).
2. **Gate on `crm.list-product-tours`.** When the flag is off, do not mount `<ProductTour>` and do not pass `onReplayGuide` (so the button is omitted).
3. **Tasks extra gate.** Phase 1 also requires `crm.tasks-workspace-redesign`. The redesign page is the only tasks mount point.
4. **Auto-skip.** Feature-gated or permission-gated controls must be absent from the DOM when off, not hidden with CSS. The engine skips missing targets after a short wait (`onEnter` can switch views first).
5. **`onEnter`.** Use it when a step’s target only exists in another view (tasks Group by → List; deal table vs board). Same as detail tours calling `setTab`.
6. **Replay** calls `ProductTourHandle.restart()` — does **not** clear seen-state and does **not** POST `seen` again.
7. **Search** lives in [`PageLayout`](resources/js/Components/PageLayout.tsx) `searchComp`, not in `EntityListHeader`. Wrap `UniversalSearchBox` in a `data-tour` div on the page; do not add tour attrs to global `PageLayout`.
8. **Bulk bars / admin-only gears** are mentioned in body copy, not dedicated steps (they are often absent).
9. **Do not** put Replay into global `PageLayout`. Lists use `EntityListHeader` / `TasksHeader`. Settings pages add a local button at the top of page content (Phases 4–5).

### Wiring pattern (every page)

```tsx
const showProductTour = featureFlags?.["crm.list-product-tours"] === true;
const tourRef = useRef<ProductTourHandle>(null);

{showProductTour && (
    <ProductTour
        ref={tourRef}
        tourId={TOUR_ID}
        steps={steps}
        labels={TOUR_LABELS}
    />
)}

// Header:
onReplayGuide={showProductTour ? () => tourRef.current?.restart() : undefined}
```

Seen-state is already per `tourId`. Completing `leads-list-v1` must not mark `lead-redesign-v1` seen.

---

## Phase 0 — Shared plumbing

**Must be first.** No page tour yet — only the flag and the Replay control on list headers.

### Files

| Action | Path |
|--------|------|
| Register flag | [`config/features.php`](config/features.php) — add `'crm.list-product-tours'` to `known_flags` |
| Replay on leads + deals header | [`EntityListHeader.tsx`](resources/js/Components/Redesign/primitives/EntityListHeader.tsx) |
| Replay on tasks header | [`TasksHeader.tsx`](resources/js/Pages/Tasks/Redesign/components/TasksHeader.tsx) → pass through [`TasksWorkspaceChrome.tsx`](resources/js/Pages/Tasks/Redesign/components/header/TasksWorkspaceChrome.tsx) |

### EntityListHeader

Add optional props. Omit the button when `onReplayGuide` is undefined (not a no-op).

- `onReplayGuide?: () => void`
- `replayGuideLabel?: string` — parent passes `t("pages.leads.list_tour.replay_menu_item")` / `t("pages.deals.list_tour.replay_menu_item")`. Until Phase 2/3 land those keys, Phase 0 can pass a temporary English string **or** wait to wire the label in the same PR as Phase 2/3; the **button plumbing** must exist in Phase 0.

Place a ghost button (`dr-btn dr-btn-ghost`) in the title-row actions cluster (with Import / Refresh / Add), **before** `leadingActions`/`actions` so Replay sits with the secondary actions. Do not hardcode `data-tour` values for a single entity; optional `replayTourTarget?: string` is fine if a later phase needs to spotlight the button (list tours do not require a Replay step — closing copy points at it).

Do **not** put entity-specific `data-tour` strings inside the primitive. Later phases pass optional tour-target props or wrap from the Index.

### TasksHeader

Same contract: `onReplayGuide?: () => void`, `replayGuideLabel?: string`. Ghost button in the actions row (after Refresh, before Task settings / Add task). Thread the props through `TasksWorkspaceChrome`. Phase 1 passes the real `t("pages.tasks.tour.replay_menu_item")` and the restart handler.

### Engine

Do not change `ProductTour` / `useProductTour` / `ProductTourController` in this phase.

### Implementation checklist

- [ ] `'crm.list-product-tours'` in `config/features.php` `known_flags`
- [ ] `EntityListHeader`: `onReplayGuide` + `replayGuideLabel`; button omitted when handler undefined; ghost **Replay guide** in the actions cluster
- [ ] `TasksHeader` + `TasksWorkspaceChrome`: same optional Replay props, omitted when undefined
- [ ] No `<ProductTour>` mounted yet; no settings Replay yet (Phases 4–5)

---

## Phase 1 — Tasks list (`tasks-list-v1`)

Depends on Phase 0. Redesign only.

**Mount when both** `crm.tasks-workspace-redesign` **and** `crm.list-product-tours` are on. Wire only in [`TasksWorkspaceRedesign.tsx`](resources/js/Pages/Tasks/Redesign/TasksWorkspaceRedesign.tsx) — [`Tasks/Index.tsx`](resources/js/Pages/Tasks/Index.tsx) already switches on the redesign flag; do not add a tour to `LegacyTasksIndex`.

### Files to create / touch

| Action | Path |
|--------|------|
| Create | `resources/js/Pages/Tasks/Redesign/config/taskListTourSteps.ts` — `TASKS_LIST_TOUR_ID`, `TASKS_LIST_TOUR_LABELS`, `buildTaskListTourSteps(setView)` |
| Lang | `resources/lang/{eng,de,ru,tr}/pages.php` → `pages.tasks.tour` (next/back/done/skip/replay_menu_item + `steps.*`) |
| `data-tour` | [`TasksHeader.tsx`](resources/js/Pages/Tasks/Redesign/components/TasksHeader.tsx), [`TasksFilterBar.tsx`](resources/js/Pages/Tasks/Redesign/components/TasksFilterBar.tsx), [`TasksWorkspaceChrome.tsx`](resources/js/Pages/Tasks/Redesign/components/header/TasksWorkspaceChrome.tsx), list/board wrappers in `TasksWorkspaceRedesign` |
| Search wrap | `searchComp` in `TasksWorkspaceRedesign` |
| Wire | `TasksWorkspaceRedesign`: `<ProductTour>` + `onReplayGuide` into chrome |

`buildTaskListTourSteps` needs `setView` from [`useTasksViewNavigation`](resources/js/Pages/Tasks/Redesign/hooks/useTasksViewNavigation.ts) so Group by can `onEnter: () => setView("list")`.

### `data-tour` map

| `data-tour` | Where |
|-------------|--------|
| `tasks-list-header` | Title + headline in `TasksHeader` |
| `tasks-list-view-toggle` | List / Board segmented control |
| `tasks-list-add` | Add task button (only rendered when `canAddTask`) |
| `tasks-list-settings` | Task settings gear (only when `showTaskSettings`) |
| `tasks-list-quick-filters` | Quick-filter `TaskSegmented` in `TasksFilterBar` |
| `tasks-list-group-by` | Group-by cluster (only when `showGroupBy` / list view) |
| `tasks-list-filters` | Filters button in `TasksFilterBar` |
| `tasks-list-filter-sentence` | `ActiveFilterSentence` band in `TasksWorkspaceChrome` |
| `tasks-list-search` | Wrapper around `UniversalSearchBox` |
| `tasks-list-body` | Wrapper around list **or** board (one target that exists in both views, or two targets with auto-skip — prefer one wrapper that always mounts around the active view) |

### Tour sequence + English copy

`tourId`: `tasks-list-v1`  
Labels: `pages.tasks.tour.{next,back,done,skip}` — Next / Back / Done / Skip tour  
Replay: `pages.tasks.tour.replay_menu_item` — Replay guide

| # | Target | `onEnter` | Skip when | Title | Body |
|---|--------|-----------|-----------|-------|------|
| 1 | `tasks-list-header` | — | — | Your tasks at a glance | Open, overdue, and due-today counts sit under the title so you can see the load before you filter. |
| 2 | `tasks-list-view-toggle` | — | — | Switch between List and Board | List groups tasks for scanning and bulk actions. Board is the same work by status column — drag to move. Your last view is kept in the URL. |
| 3 | `tasks-list-add` | — | No add permission | Create a task | Add task opens the form with checklist, attachments, and links to a deal, lead, or project. |
| 4 | `tasks-list-settings` | — | Gear hidden (not admin / no category permission) | Task settings | Open categories and related task settings from the gear. Most people will not see this control. |
| 5 | `tasks-list-quick-filters` | — | — | Jump to a slice of the work | All, Assigned to me, Assigned by me, Open, Due today, Overdue, and Mentioned — counts are live. These combine with the full Filters drawer. |
| 6 | `tasks-list-group-by` | `setView("list")` | — | Group the list | Due date, Category, or None. Group by only appears in List — this step switches you there first. |
| 7 | `tasks-list-filters` | — | — | Narrow with Filters | Open the drawer for assignee, category, dates, and saved views. A badge shows how many filters are on. |
| 8 | `tasks-list-filter-sentence` | — | — | See what you are looking at | This line reads the active filters in plain language. Click it to open Filters again. |
| 9 | `tasks-list-search` | — | — | Search from the top bar | The search box in the page header finds tasks by name without leaving this list. |
| 10 | `tasks-list-body` | — | — | Open a task, or select several | Click a row or card to open it. In List, checkboxes select rows for bulk update or delete — the bulk bar appears after you select. |
| 11 | *(centered, no target)* | — | — | You're ready | Replay this guide anytime from Replay guide in the header. |

### Implementation checklist

- [ ] `config/taskListTourSteps.ts` (`TASKS_LIST_TOUR_ID` = `tasks-list-v1`, labels, `buildTaskListTourSteps`)
- [ ] Lang: `pages.tasks.tour` in eng / de / ru / tr (chrome + every step title/body above)
- [ ] `data-tour` attributes per the map
- [ ] Wrap `searchComp` with `data-tour="tasks-list-search"`
- [ ] Mount `<ProductTour>` in `TasksWorkspaceRedesign` only when **both** flags are on
- [ ] Pass `onReplayGuide` + `replayGuideLabel` into chrome
- [ ] Group-by step `onEnter` → `setView("list")`

---

## Phase 2 — Lead list (`leads-list-v1`)

Depends on Phase 0 (`EntityListHeader` Replay).

### Files to create / touch

| Action | Path |
|--------|------|
| Create | `resources/js/Pages/Leads/config/leadListTourSteps.ts` — `LEADS_LIST_TOUR_ID`, `LEADS_LIST_TOUR_LABELS`, `buildLeadListTourSteps()` |
| Lang | `pages.leads.list_tour` in eng / de / ru / tr — **do not** edit `pages.leads.tour` |
| `data-tour` | [`Leads/Index.tsx`](resources/js/Pages/Leads/Index.tsx) + optional tour-target props on `EntityListHeader` if wrapping is cleaner than forking the primitive |
| Wire | `Leads/Index.tsx`: `<ProductTour>` when `crm.list-product-tours`; `onReplayGuide` + `replayGuideLabel={t("pages.leads.list_tour.replay_menu_item")}` |

Leads has no view toggle. Filters sit in the title-row `actions` via `FiltersButton` (not the second toolbar row). Due this week is `leadingActions` and only renders when `nextActionDueThisWeekCount > 0`.

Qualification mapping gear is admin-only — mention in Filters/closing copy, not its own step.

### `data-tour` map

| `data-tour` | Where |
|-------------|--------|
| `leads-list-header` | Title + stats subtitle on `EntityListHeader` |
| `leads-list-due-this-week` | Due this week chip (`leadingActions`) — only in DOM when count > 0 |
| `leads-list-search` | Wrapper around `UniversalSearchBox` |
| `leads-list-import` | Import button |
| `leads-list-filters` | Filters button |
| `leads-list-add` | Add lead button |
| `leads-list-filter-sentence` | `ActiveFilterSentence` (filter v2). When `crm.leads-filter-v2` is off, this band is omitted — step auto-skips |
| `leads-list-table` | Table container (`DataTable` / `leads-table` wrap) |

Prefer optional props on `EntityListHeader` (`titleTourTarget`, `filtersTourTarget`, `filterSentenceTourTarget`, …) over hardcoding `leads-list-*` inside the shared primitive. Action buttons can take `data-tour` in the Index `actions` JSX.

### Tour sequence + English copy

`tourId`: `leads-list-v1`  
Labels: `pages.leads.list_tour.{next,back,done,skip}`  
Replay: `pages.leads.list_tour.replay_menu_item`

| # | Target | `onEnter` | Skip when | Title | Body |
|---|--------|-----------|-----------|-------|------|
| 1 | `leads-list-header` | — | — | Your leads at a glance | Total leads, overdue next actions, due this week, and hot leads sit under the title so you can see what needs attention. |
| 2 | `leads-list-due-this-week` | — | Chip not rendered (count is 0) | Jump to what is due this week | This chip applies a next-action filter for the week. Use it when you want that slice without opening Filters. |
| 3 | `leads-list-search` | — | — | Search from the top bar | Find a lead by name or contact details without leaving the list. |
| 4 | `leads-list-import` | — | — | Import leads | Bring leads in from a file. Use Add lead when you are creating one record. |
| 5 | `leads-list-filters` | — | — | Narrow the list | Filters open a workbench for lifecycle, owner, dates, and more. Saved views live here when filter v2 is on. A badge shows how many filters are active. |
| 6 | `leads-list-add` | — | — | Create a lead | Add lead opens the create form. Open an existing row to work the full lead page. |
| 7 | `leads-list-filter-sentence` | — | Filter v2 off (sentence omitted) | See what you are looking at | This line reads the active filters in plain language. Click it to open Filters again. |
| 8 | `leads-list-table` | — | — | Work the list | Click a row to open the lead. Checkboxes select rows for bulk update — the bulk bar appears after you select. Next action and status sit on the row. |
| 9 | *(centered)* | — | — | You're ready | Replay this guide anytime from Replay guide in the header. |

### Implementation checklist

- [ ] `Pages/Leads/config/leadListTourSteps.ts`
- [ ] Lang: `pages.leads.list_tour` in eng / de / ru / tr; leave `pages.leads.tour` untouched
- [ ] `data-tour` per the map (Due this week attr only on the chip that already mounts conditionally)
- [ ] Wrap `searchComp` with `data-tour="leads-list-search"`
- [ ] Mount `<ProductTour>` when `crm.list-product-tours`
- [ ] Pass `onReplayGuide` + `replayGuideLabel` into `EntityListHeader`

---

## Phase 3 — Deal list (`deals-list-v1`)

Depends on Phase 0. Same `EntityListHeader` as leads.

### Files to create / touch

| Action | Path |
|--------|------|
| Create | `resources/js/Pages/Deals/config/dealListTourSteps.ts` — `DEALS_LIST_TOUR_ID`, `DEALS_LIST_TOUR_LABELS`, `buildDealListTourSteps(setView)` |
| Lang | `pages.deals.list_tour` in eng / de / ru / tr — **do not** edit `pages.deals.tour` |
| `data-tour` | [`Deals/Index.tsx`](resources/js/Pages/Deals/Index.tsx) + `EntityListHeader` tour-target props + [`PipelineSelector`](resources/js/Features/Deals/PipelineSelector.tsx) wrap |
| Wire | `Deals/Index.tsx`: `<ProductTour>` + Replay on `EntityListHeader` |

View toggle values are `"table"` | `"kanban"` via [`useViewPreference`](resources/js/Pages/Deals/Index.tsx). Table and board are mutually exclusive — `onEnter` for the body step should switch to table (`setView("table")`) so the table target exists, **or** use a single wrapper around whichever view is active (same as tasks body). Prefer `onEnter: () => setView("table")` on the table step so Board-first users still see the table explanation; the board is covered in the view-toggle step.

### `data-tour` map

| `data-tour` | Where |
|-------------|--------|
| `deals-list-header` | Title + stats subtitle |
| `deals-list-view-toggle` | Table / Board control on `EntityListHeader` |
| `deals-list-pipeline` | `PipelineSelector` (`toolbarLeft`) |
| `deals-list-filters` | Filters button (second toolbar row) |
| `deals-list-search` | Wrapper around `UniversalSearchBox` |
| `deals-list-actions` | Wrap Import + Add deal (one target for both primary actions) |
| `deals-list-filter-sentence` | `ActiveFilterSentence` band |
| `deals-list-table` | Table container — `onEnter` set table view |

### Tour sequence + English copy

`tourId`: `deals-list-v1`  
Labels: `pages.deals.list_tour.{next,back,done,skip}`  
Replay: `pages.deals.list_tour.replay_menu_item`

| # | Target | `onEnter` | Skip when | Title | Body |
|---|--------|-----------|-----------|-------|------|
| 1 | `deals-list-header` | — | — | Your deals at a glance | Active deals in the selected pipeline and won-this-week sit under the title. |
| 2 | `deals-list-view-toggle` | — | — | Switch between Table and Board | Table is for scanning, sorting, and bulk actions. Board is the pipeline by stage — drag a card to move the deal. |
| 3 | `deals-list-pipeline` | — | — | Pin a pipeline, or see all | The chip filters this list to one pipeline or All. Stats and the board follow the same pin. |
| 4 | `deals-list-filters` | — | — | Narrow with Filters | Stage, agent, dates, and more. A badge shows how many filters are on. |
| 5 | `deals-list-search` | — | — | Search from the top bar | Find a deal by name without leaving the list. |
| 6 | `deals-list-actions` | — | — | Import or create | Import brings deals in from a file. Add deal starts a new record in the current (or default) pipeline. |
| 7 | `deals-list-filter-sentence` | — | — | See what you are looking at | This line reads the active filters in plain language. Click it to open Filters again. |
| 8 | `deals-list-table` | `setView("table")` | — | Work the table | Click a row to open the deal. Checkboxes select rows for bulk update — the bulk bar is table-only and appears after you select. Switch back to Board anytime from the toggle. |
| 9 | *(centered)* | — | — | You're ready | Replay this guide anytime from Replay guide in the header. |

### Implementation checklist

- [ ] `Pages/Deals/config/dealListTourSteps.ts` with `setView` for the table step
- [ ] Lang: `pages.deals.list_tour` in eng / de / ru / tr; leave `pages.deals.tour` untouched
- [ ] `data-tour` per the map
- [ ] Wrap `searchComp` with `data-tour="deals-list-search"`
- [ ] Mount `<ProductTour>` when `crm.list-product-tours`
- [ ] Pass `onReplayGuide` + `replayGuideLabel` into `EntityListHeader`

---

## Phase 4 — Preferences (`preferences-v1`)

Depends on Phase 0 only for the flag. **Do not** use `EntityListHeader`. Add a local Replay control at the top of page content.

### Files to create / touch

| Action | Path |
|--------|------|
| Create | `resources/js/Pages/Settings/config/preferencesTourSteps.ts` |
| Lang | Add `settings.preferences_tour` under `pages` in eng / de / ru / tr (`pages.settings.preferences_tour`) |
| `data-tour` | [`Preferences.tsx`](resources/js/Pages/Settings/Preferences.tsx) — wrap existing `Section`s / inner blocks |
| Wire | Same file: `<ProductTour>` + Replay button |

Replay: a ghost **Replay guide** button in a short toolbar row above the sections grid (right-aligned is fine). Omit when the flag is off. Do not change [`PageLayout`](resources/js/Components/PageLayout.tsx).

Notification bypass is the right-hand `Section` and only mounts when `bypassEnabled` is true (`crm.notification-bypass`). Put `data-tour` on that section so the step auto-skips when absent.

### `data-tour` map

| `data-tour` | Where |
|-------------|--------|
| `preferences-timezone` | Timezone `Section` (picker + helper text) |
| `preferences-browser-sync` | “Keep in sync with this browser” row (switch) |
| `preferences-in-app-alerts` | In-app alerts `Section` |
| `preferences-notifications` | Notifications bypass `Section` (conditional) |

### Tour sequence + English copy

`tourId`: `preferences-v1`  
Labels: `pages.settings.preferences_tour.{next,back,done,skip}`  
Replay: `pages.settings.preferences_tour.replay_menu_item`

| # | Target | `onEnter` | Skip when | Title | Body |
|---|--------|-----------|-----------|-------|------|
| 1 | `preferences-timezone` | — | — | Times in the CRM use this zone | Pick your timezone when per-user timezone is on. Every timestamp you see follows this zone. |
| 2 | `preferences-browser-sync` | — | — | Keep in sync with this browser | When this is on, the CRM may update your zone to match the browser on the next visit. Turn it off to lock the picker value. |
| 3 | `preferences-in-app-alerts` | — | — | In-app alerts | Position, duration, and mute for toast alerts in this browser session. These are already saved to your account. |
| 4 | `preferences-notifications` | — | `bypassEnabled` is false | Choose which notifications you get | Turn a type off to stop email, in-app, and push for that type. Security and account emails cannot be turned off. |
| 5 | *(centered)* | — | — | You're ready | Replay this guide anytime from Replay guide at the top of this page. Meeting reminder times are a separate page under Reminder preferences. |

### Implementation checklist

- [ ] `Pages/Settings/config/preferencesTourSteps.ts`
- [ ] Lang: `pages.settings.preferences_tour` in eng / de / ru / tr
- [ ] `data-tour` on the four regions (notifications only when the section mounts)
- [ ] Local Replay guide button omitted when flag off
- [ ] Mount `<ProductTour>` when `crm.list-product-tours`

---

## Phase 5 — Reminder preferences (`reminder-preferences-v1`)

Same settings Replay pattern as Phase 4. Separate `tourId` — this tour must never run on Preferences and vice versa.

### Files to create / touch

| Action | Path |
|--------|------|
| Create | `resources/js/Pages/Settings/config/reminderPreferencesTourSteps.ts` |
| Lang | `pages.settings.reminder_preferences_tour` in eng / de / ru / tr |
| `data-tour` | [`ReminderPreferences.tsx`](resources/js/Pages/Settings/ReminderPreferences.tsx) |
| Wire | Same file: `<ProductTour>` + local Replay button |

### `data-tour` map

| `data-tour` | Where |
|-------------|--------|
| `reminders-enable` | Meeting reminders `Section` header + Enable reminders switch (`extra`) |
| `reminders-rows` | The list of time + unit rows (including Add reminder) |
| `reminders-save-reset` | Reset to defaults + Save changes row |
| `reminders-defaults` | Defaults `Section` |

### Tour sequence + English copy

`tourId`: `reminder-preferences-v1`  
Labels: `pages.settings.reminder_preferences_tour.{next,back,done,skip}`  
Replay: `pages.settings.reminder_preferences_tour.replay_menu_item`

| # | Target | `onEnter` | Skip when | Title | Body |
|---|--------|-----------|-----------|-------|------|
| 1 | `reminders-enable` | — | — | Meeting reminders | These times notify you before meetings. A single meeting can still override them. Use Enable reminders to turn the whole set off. |
| 2 | `reminders-rows` | — | — | Set when you are notified | Each row is “this long before the meeting.” Add more (up to 20) or remove extras — at least one row stays. |
| 3 | `reminders-save-reset` | — | — | Save, or restore defaults | Save writes your times. Reset to defaults restores 1 hour, 30 minutes, 15 minutes, and 5 minutes after a confirm. |
| 4 | `reminders-defaults` | — | — | What you get if you never customize | If you have not set custom reminders, you are notified 1 hour, 30 minutes, 15 minutes, and 5 minutes before the meeting. |
| 5 | *(centered)* | — | — | You're ready | Replay this guide anytime from Replay guide at the top of this page. Timezone and in-app alerts live under Preferences. |

### Implementation checklist

- [ ] `Pages/Settings/config/reminderPreferencesTourSteps.ts`
- [ ] Lang: `pages.settings.reminder_preferences_tour` in eng / de / ru / tr
- [ ] `data-tour` per the map
- [ ] Local Replay guide button omitted when flag off
- [ ] Mount `<ProductTour>` when `crm.list-product-tours`
- [ ] This page does not import or run `preferences-v1`

---

## Out of scope (all phases)

- Legacy tasks index (`LegacyTasksIndex`)
- Other lists (projects, properties, …)
- Changing lead/deal **detail** tours (`lead-redesign-v1`, `deal-redesign-v1`, `crm.leads-product-tour`)
- Enabling `crm.list-product-tours` in production (ops, after Phase 6)
- New tour library / forked `ProductTour`

## Resolved decisions

- Reuse shared `ProductTour` engine; do not fork.
- One flag: `crm.list-product-tours`.
- Replay guide in the header (lists) or top of settings content — not the ⋮ menu.
- Static `t()` lang keys (not `td()`), matching detail tours.
- Conditional regions rely on auto-skip rather than a dynamic step list.
- Tasks: redesign only.
- English copy in this brief is the source of truth for implementers.

---

## Phase 6 — Validation / verification

**Do not start until Phases 0–5 are implemented.** This phase is checks only — no new features. Enable the flag in a local/staging environment to run these; do not enable in production from this brief.

### Flag and chrome

- [ ] Flag **off**: none of the five pages show a tour overlay; none show Replay guide
- [ ] Flag **on**: each of the five pages can auto-start its own tour when that `tourId` is unseen
- [ ] Tasks: legacy index never tours; redesign tours only when **both** `crm.tasks-workspace-redesign` and `crm.list-product-tours` are on

### Seen-state

- [ ] Skip and Done POST `product-tours.seen` and do not auto-start on reload
- [ ] Replay starts at step 1 and does not clear seen-state
- [ ] Completing `leads-list-v1` does not mark `lead-redesign-v1` seen (and vice versa)
- [ ] Completing `deals-list-v1` does not mark `deal-redesign-v1` seen (and vice versa)
- [ ] Completing `preferences-v1` does not mark `reminder-preferences-v1` seen (and vice versa)

### Skip / missing targets

- [ ] Tasks: no Add task / no Task settings → those steps skip; start on Board → Group by still works (`onEnter` → List)
- [ ] Lead list: `nextActionDueThisWeekCount = 0` → no chip step; filter v2 off → filter-sentence step skips
- [ ] Deal list: start on Board → table step `onEnter` switches to table (does not stall)
- [ ] Preferences: `bypassEnabled` false → notifications step skips
- [ ] Reminder preferences: page still tours when reminders are disabled (enable switch is the first target)

### Copy

- [ ] de / ru / tr: chrome (Next / Back / Done / Skip tour / Replay guide) and steps resolve — no raw keys on screen
- [ ] Closing copy points at **Replay guide**, not the ⋮ menu

### Ops

- [ ] Enable `crm.list-product-tours` per environment (Infisical / feature-flag admin) after copy is signed off in staging — **ops**, not the implementer by default
