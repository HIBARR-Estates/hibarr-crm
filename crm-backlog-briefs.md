# What It Takes: The CRM Half of the Backlog

Twelve items pulled from the September backlog — the ones that live in `hibarr-crm`. Each brief below is grounded in a direct read of the code: current behavior, root cause where relevant, the files a fix would touch, and a rough size (XS–XL). Nothing here has been built yet.

**Scope:** 7 features, 4 bugs, 1 access-control item.

---

## 1 · CRM Features

### 1.1 Standardize meeting creation on dashboards — `M`

**Current state**
Two parallel implementations exist. The modern one — `ScheduleMeetingModal.tsx` + `MeetingFormFields.tsx` under `Components/Redesign/modals/` — is already live on the flagged Deal page (`crm.deal-view-redesign`), the flagged Lead page, and the redesigned Meetings workspace. Both dashboards (`Dashboard/Index.tsx`, `ComprehensiveDashboard.tsx`, `Dashboard/V2/PersonalDashboard.tsx`) still open the legacy Ant Design `ScheduleMeetingDrawer.tsx` via `MeetingsPanel.tsx`'s "+ Schedule" button. A third, vestigial modal under `ActivitySidebar/modals/` doesn't create a meeting at all — it just opens a `mailto:` link — and can be deleted outright.

**What it takes**
Wire the dashboard "+ Schedule" entry points to the shared modal behind a new flag (e.g. `crm.new-meeting-modal`), reusing the deal/lead record-picker step already built for the Meetings workspace (`useScheduleRecordSource.ts`) rather than re-inventing it. Register the flag in `config/features.php`. Retire `ScheduleMeetingDrawer.tsx` once dashboards move over.

**Files & touchpoints**
- `resources/js/Features/Dashboard/Components/MeetingsPanel.tsx`
- `resources/js/Pages/Dashboard/V2/PersonalDashboard.tsx`
- `resources/js/Pages/Meetings/Redesign/components/MeetingsScheduleDialog.tsx` — pattern to copy
- `config/features.php`

---

### 1.2 Replace remaining meeting modals on cards/rows — `M`

**Current state**
The legacy (flag-off) Deal and Lead pages still route into the antd `AddFollowup` → `SaveFollowup` pair. The Lead index "next action" flow is already half-modernized — `ScheduleNextStepFlow.tsx` is built on Redesign primitives — but still calls its own bespoke `useLeadIndexMeetingCreate.ts` instead of the shared modal.

**What it takes**
Point `ScheduleNextStepFlow.tsx`'s meeting step directly at the shared `ScheduleMeetingModal`, and delete the dead mailto-only modal plus its opener in `QuickActions2.tsx`. The bulk of "legacy" surface area is already scheduled to disappear once the Deal/Lead redesign flags go to 100% — worth confirming with product whether the antd pages need parity at all before touching them, since that decision resizes this item.

**Files & touchpoints**
- `resources/js/Features/Leads/NextAction/ScheduleNextStepFlow.tsx`
- `resources/js/Features/Leads/NextAction/useLeadIndexMeetingCreate.ts`
- `resources/js/Pages/Deals/Components/ActivitySidebar/modals/ScheduleMeetingModal.tsx` — delete

> **Decision needed:** is the legacy antd Deal/Lead page in scope, or is it being sunset by the redesign flags? Answer changes this from M to S.

---

### 1.3 Separate reminder config for lead vs. attendee emails — `M`

**Current state**
The recipient-type split already exists structurally: `Reminder::RECIPIENT_USER` vs. `RECIPIENT_LEAD`, built by `MeetingReminderSync::buildRecipients()`, with fully separate subject/body/footer copy per type in `MeetingEmailPresenter` (leads never get the "View Deal" button). What's missing is *cadence*: `ReminderCreator::resolveCadenceMinutes()` only consults the per-user `UserReminderPreference` table for `RECIPIENT_USER` — leads always fall through to the flat company default (1hr / 30 / 15 / 5 min), with no override point at all.

**What it takes**
Add a second cadence-config path that `resolveCadenceMinutes()` checks for `RECIPIENT_LEAD` before the global fallback — this is the actual "different configuration" the backlog item is asking for. Decide separately whether the shared Blade/Plunk template also needs to fork, or whether the existing presenter-level content split already covers it.

**Files & touchpoints**
- `app/Services/Reminders/ReminderCreator.php` — `resolveCadenceMinutes()`
- `app/Support/MeetingEmailPresenter.php`
- `app/Models/EntityReminderDefault.php`

---

### 1.4 Copy-to-clipboard on lead and deal fields — `S`

**Current state**
This already works — on Leads only. `DossierField.tsx` implements a full clipboard-API-with-fallback copy button, a copied/failed state, and reuses the `copy`/`check` glyphs already in the shared icon set. It lives outside `Components/Redesign/primitives/`, so Deals fields (`DealEditableField.tsx` → shared `EditableField.tsx`) have no copy affordance at all.

**What it takes**
Extract the clipboard logic from `DossierField.tsx` into a small shared hook and wire it into `EditableField.tsx` and the Deal value primitives. No new interaction to design — this is promote-and-reuse.

**Files & touchpoints**
- `resources/js/Pages/Leads/Redesign/components/dossier/DossierField.tsx` — source of the logic
- `resources/js/Components/Redesign/primitives/EditableField.tsx`
- `resources/js/Pages/Deals/Redesign/components/primitives/DealValueBlock.tsx`, `DealDateBlock.tsx`

---

### 1.5 Property / unit completeness score — `M`

**Current state**
`Property` carries a large, sparse field surface — pricing, legal, location, specs, media, marketing — and already defines, per category and sale type, which fields are expected via `getAllowedFields()` / `getPropertyConfigurations()`. That's a ready-made weighting checklist. There's no separate `Unit` model — unit-type templates live on `DeveloperProjectUnitType`. On the frontend, a generic completeness primitive already exists and is proven: `CompletionDot.tsx` (filled/total dot, used today on the Deal info sidebar) plus a `ProgressRing.tsx` for a percentage variant.

**What it takes**
A new backend scorer that walks `getAllowedFields()` per category/sale-type and returns a percentage or filled/total pair; surface it on the Property list/detail using the same `CompletionDot` / `ProgressRing` primitives already shipping on Deals.

**Files & touchpoints**
- `app/Models/Property.php` — `getAllowedFields()`, `getPropertyConfigurations()`
- `app/Services/PropertyCompletenessScorer.php` — new
- `resources/js/Components/Redesign/primitives/CompletionDot.tsx`, `ProgressRing.tsx`

---

### 1.6 CRM island: live running task timer — `M`

**Current state**
"Island" today means exactly one thing — `NotificationAlertProvider.tsx`, a floating, feature-flag-gated pill for ephemeral notifications. It's a solid structural template (fixed position, expand-on-hover) but has never carried continuously-ticking state. The timer domain itself is mature and already built server-side: `ProjectTimeLog` (start/end time, a live `getTimerAttribute()` string, `selfActiveTimer()`), plus working start/stop routes — it's just never been exposed to the React/Inertia stack, only to legacy Blade views.

**What it takes**
One small new endpoint exposing `ProjectTimeLog::selfActiveTimer()` for the current user, and a new persistent React component modeled structurally on `NotificationAlertProvider.tsx` that polls it and ticks the elapsed time client-side. Gate behind a new flag the same way the notification island is gated.

**Files & touchpoints**
- `app/Models/ProjectTimeLog.php` — `selfActiveTimer()`
- `app/Http/Controllers/TimelogController.php` — start_timer / stop_timer routes exist
- `resources/js/Components/NotificationAlertProvider.tsx` — structural pattern to copy

---

### 1.7 Announcements, with CRM as a channel — `XL`

**Current state**
Confirmed from scratch: no `Announcement` model, migration, controller, route, or UI exists anywhere in the repo — one unrelated code-comment is the only hit for the word. The closest structural precedent is `Reminder`'s multi-recipient-type modeling (`RECIPIENT_USER` / `RECIPIENT_LEAD` / `RECIPIENT_EMAIL`, per-entity cadence), which already solves "one message, several recipient types, several delivery paths."

**What it takes**
A genuinely new subsystem: an `Announcement` model (title, body, audience/scope, publish window), an authoring UI, and a per-recipient delivery/read-state mechanism. Because this item is explicitly paired with the same fix in Backoffice, the schema question — one shared table with a `channel` column, versus two independent implementations — needs to be settled across both repos before either team starts building.

**Files & touchpoints**
- No existing files — net new
- `app/Models/Reminder.php` — reference pattern
- `app/Services/Reminders/ReminderCreator.php` — reference pattern

> **Blocker:** needs a cross-repo schema decision with Backoffice before implementation starts.

---

## 2 · CRM Bugs

All four bugs were fully root-caused by reading the code — no reproduction guesswork needed.

### 2.1 "Complete task" doesn't register until refresh — `S`

**Root cause**
`useTasksServerPagination.ts` returns a brand-new object on every render instead of a memoized one. `TasksWorkspaceRedesign.tsx` has a resync effect that depends on that unstable reference, so it fires on effectively every render and overwrites `listTasks` with the stale, pre-completion server data — clobbering the optimistic update that "complete" just applied. It's most visible for notification-opened tasks because those rely on a freshly-merged deferred prop that this effect is quick to stomp; a stale list entry can also shadow a correctly-patched board entry in the merged view.

**Fix**
Memoize the hook's return value (at minimum the task array), and point the resync effect at the actual `tableTasks` prop instead of the freshly-built pagination object — mirroring how the board's equivalent effect already does it correctly.

**Files & touchpoints**
- `resources/js/Pages/Tasks/Redesign/hooks/useTasksServerPagination.ts`
- `resources/js/Pages/Tasks/Redesign/TasksWorkspaceRedesign.tsx` — lines ~336-359, ~419-421

---

### 2.2 Back button needs ~3 clicks to leave a lead/deal — `XS`

**Root cause**
The detail pages themselves are innocent — both `useDealViewNavigation.ts` and `useLeadViewNavigation.ts` already use `history.replaceState` exclusively for tab/section sync. The extra history entries come from the list pages navigated *from*: six pagination calls (`onPageChange`, `onPageSizeChange`, page-size restore) in `Deals/Index.tsx` and `Leads/Index.tsx` omit `replace: true`, unlike the filter and view-toggle handlers on the very same pages, which already pass it. Every page-turn pushes a fresh, visually identical history entry.

**Fix**
Add `replace: true` to the six identified calls — the correct pattern already exists twice on each page, just not applied to pagination.

**Files & touchpoints**
- `resources/js/Pages/Deals/Index.tsx` — lines ~546, 748, 765
- `resources/js/Pages/Leads/Index.tsx` — lines ~299, 658, 673

---

### 2.3 Lead notifications open the lead instead of the deal — `S`

**Root cause**
The routing intent already exists — `NotificationService::notificationLinkRoutes()` correctly maps `new_lead_created` to `deals.show`. But `NewLeadCreated::toArray()` never includes a `deal_id`, so the link resolver falls back to the lead's own id and builds a broken deal URL. Sibling notification classes (`LeadAgentAssigned`, `LeadFollowUpOverdue`) already do this correctly and are the pattern to copy — one already sets `action_url` directly with a conditional fallback for leads that have no deal yet.

**Fix**
Resolve and include the deal id in `NewLeadCreated::toArray()` — the deal is already created earlier in the same request via `LeadContactController::storeDeal()` — and fall back to the lead's own page when no deal exists, since not every lead gets one.

**Files & touchpoints**
- `app/Notifications/NewLeadCreated.php`
- `app/Http/Controllers/LeadContactController.php` — `storeDeal()`
- `app/Notifications/LeadFollowUpOverdue.php` — `actionUrl()`, pattern to copy

---

### 2.4 Editing a lead to a duplicate email fails silently — `S`

**Root cause**
Two request classes validate leads, and the live inline-edit path uses the weaker one. `PatchRequest.php` (used by every inline field edit) has no uniqueness rule on `client_email`, unlike `UpdateRequest.php` (used only by the legacy full-page edit form). The duplicate is only caught by a database-level unique index at save time, and the controller's blanket exception handler converts that into a generic, useless message returned with an HTTP 200 — discarding the real cause before it ever reaches the frontend, which otherwise handles and displays real errors correctly.

**Fix**
Add the same scoped uniqueness rule to `PatchRequest.php`, and stop swallowing the resulting validation exception in the controller's catch-all so it surfaces as a normal 422 field error instead of a silent 200.

**Files & touchpoints**
- `app/Http/Requests/Lead/PatchRequest.php`
- `app/Http/Controllers/LeadContactController.php` — `patch()`, lines ~1335-1348

---

## 7.1 · Access Control

The CRM half of the permission-and-flag-checker item; the OS half is the same tool ported.

### 7.1 Permission & feature-flag checker — `L`

**Current state**
Two systems exist, each internally solid, with no shared abstraction between them. Permissions: a custom Entrust-based RBAC with scope tiers (all / both / owned / added / none), wrapped in named gates (`PermissionGates`), exposed to the frontend through a real `usePermission()` hook already used in 14+ files. Feature flags: a separate remote-backed system with an allow-list in `config/features.php`, consumed on the frontend via one hand-written hook *per flag* — there's no generic `useFeatureFlag(name)`. No unified checker exists in code or in any brief.

**What it takes**
A single frontend utility that answers "is X gated" regardless of whether X is a permission or a flag, replacing the current per-flag-hook duplication, plus an equivalent backend helper unifying `PermissionGates` and `FeatureFlags::enabled()`. Since the OS rollout (#5.1 / #7.2) asks for the identical tool, design the API once and port it rather than building it twice.

**Files & touchpoints**
- `resources/js/lib/permissionUtils.tsx`
- `app/Support/PermissionGates.php`
- `app/Support/FeatureFlags.php`, `config/features.php`

> **Do first:** `docs/PERMISSIONS_BRIEF.md` documents a recent permission split that's explicitly flagged as not yet frontend-smoke-tested — worth closing that out before building the unified checker on top of it.

---

*Sourced from a direct read of `hibarr-crm` on 2026-09-14. Sizes are rough (XS–XL) and assume no surprises once work starts — file paths and line numbers may drift as the branch moves.*
