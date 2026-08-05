# Reminders Revamp — Frontend Integration Guide

Status: backend + data layer complete (branch `HIB-1205-reminder-revamp`). This
doc is the handoff for the remaining **frontend** work: wiring reminder inputs
into entity forms, and finishing the reminder-preferences settings page.

## 1. What the backend now does

Every entity below has two new columns, accepted by its existing
create/update endpoints — there are no new REST routes to call for entity
reminders:

| Field | Type | Meaning |
|---|---|---|
| `remind_at` | `datetime \| null` | The anchor timestamp the reminder counts down to (a due date, flight time, follow-up date, etc). `null` / omitted disables reminders for that record. |
| `reminders` | `array<{time:number, type:'minute'\|'hour'\|'day'}> \| null` | Custom cadence: how long before `remind_at` to fire. `null` / `[]` / omitted → falls back to the company's `EntityReminderDefault` for that entity type, then to `config('reminders.default')` (1h/30m/15m/5m). |

Both fields are **optional on every payload** — send only what changed
(controllers use `$request->exists()` / `array_key_exists()`, not
`required`), so partial updates never wipe a value you didn't touch.

This is the exact same shape already used for meetings/follow-ups
(`DealFollowUp` reminders) — see `reminderLabel()` / `DEFAULT_MEETING_REMINDERS`
in [meetingFormUtils.ts](../resources/js/Components/Redesign/meeting/meetingFormUtils.ts)
and the picker UI in [MeetingFormFields.tsx](../resources/js/Components/Redesign/meeting/MeetingFormFields.tsx:377-514).
**Reuse that pattern/component rather than re-inventing a picker per entity.**

## 2. Feature flag — you don't need to gate the UI

`ReminderFeature::enabledForCompany()` (checked server-side, at save time,
per `*ReminderSync` service) is what actually decides whether a `Reminder`
row gets created/sent. It's off by default and only on for companies in
`ENTITY_REMINDERS_COMPANY_ALLOWLIST` (or `*`).

**Practical effect:** it's safe to ship the `remind_at`/`reminders` inputs on
every entity form for every company right now. If a company isn't
allow-listed yet, the values are simply stored on the record and no
`Reminder` row is created — nothing breaks, nothing errors. No feature flag
prop is currently passed to Inertia for this; don't add conditional
rendering for it unless product asks for staged UI rollout.

## 3. Per-entity endpoint reference

| Entity | Controller / methods | Existing FE form(s) to extend | FE status |
|---|---|---|---|
| Deal | `DealController@update` / inline update (`app/Http/Controllers/DealController.php:1193`, `:1494`, `:1703` bulk-update map) | `resources/js/Pages/Deals/Redesign/components/deal-info/**` (deal-info sidebar/section panels use the generic custom-field editors — `remind_at`/`reminders` aren't custom fields, need an explicit field) | **Not started** |
| Deal Note | `DealNoteController@store/update` | Deal notes composer/editor in `resources/js/Pages/Deals/Redesign/**` (note create/edit — search `useDealNoteMutations`) | **Not started** |
| Lead Note | `LeadNoteController@store/update` | Lead notes composer (Leads Redesign equivalent) | **Not started** |
| Lead / Contact | `LeadContactController@store/update` (contact core-fields save) | Lead/contact edit form | **Not started** |
| Flight Itinerary | `LeadFlightItineraryController@store/update` | [DealItineraryModal.tsx](../resources/js/Pages/Deals/Redesign/components/workspace/DealItineraryModal.tsx), [ItineraryModal.tsx](../resources/js/Components/Redesign/modals/ItineraryModal.tsx), [LeadFlightItineraryTab.tsx](../resources/js/Components/LeadFlightItineraryTab.tsx) | **Not started** |
| Property | `PropertyService@createProperty/updateProperty` | [PropertyWizardForm.tsx](../resources/js/Features/Properties/SaveProperty/PropertyWizardForm.tsx), [PropertyDetailsStep.tsx](../resources/js/Features/Properties/SaveProperty/Steps/PropertyDetailsStep.tsx) / `PropertyDetailsTab.tsx` | **Not started** |
| Developer Project | `DeveloperProjectController@store/update` | [ConstructionProjectFormModal.tsx](../resources/js/Features/DeveloperProjects/ConstructionProjectFormModal.tsx) | **Not started** |
| Unit Type | `DeveloperProjectUnitTypeController@store/update` | [UnitTypeFormModal.tsx](../resources/js/Features/DeveloperProjects/UnitTypeFormModal.tsx) | **Not started** |
| Task | `CrmWriteService@createTask/updateTask` (API v2 only — `app/Http/Controllers` task CRUD wasn't touched in this branch) | N/A for internal UI unless/until the legacy Task blade form is migrated | Confirm with backend whether internal Task UI needs this too |

Meeting/follow-up reminders already have full UI (`MeetingFormFields.tsx`,
`useDealMeetingCreate`/`useDealMeetingUpdate`, `useLeadMeetingCreate`/`useLeadMeetingUpdate`)
— no work needed there.

## 4. Settings pages

- **`/account/settings/reminder-preferences/manage`** — Inertia/React page,
  [ReminderPreferences.tsx](../resources/js/Pages/Settings/ReminderPreferences.tsx).
  **Currently only implements the `meeting` entity type**, but the backend
  (`UserReminderPreferenceController@index`) already returns preferences for
  *every* `UserReminderPreference::ENTITY_TYPES` (`meeting, task, note, deal,
  lead, property, project, unit, flight_itinerary, all`) keyed by type. This
  page needs a tab/section per entity type (or at least an "all" fallback
  section) instead of hard-coding `meetingReminders` — reuse the same table
  UI per tab, POST to `reminder-preferences.update` with the corresponding
  `entity_type`.
- **`/account/settings/entity-reminder-defaults`** (company-wide defaults,
  admin-only) and **`/account/settings/reminder-ledger`** (send queue/status)
  are server-rendered Blade views (`resources/views/entity-reminder-defaults/index.blade.php`,
  `resources/views/reminder-ledger/index.blade.php`) — already functional,
  no React work needed. Nav entries already added in
  [Sidebar.tsx:359-384](../resources/js/Components/Sidebar/Sidebar.tsx:359).

## 5. UI pattern to follow per form

Mirror what `MeetingFormFields.tsx` does:

1. A datetime picker bound to `remind_at` (nullable — clearing it should send
   `remind_at: null` on update, not omit the key, so the sync service cancels
   any pending reminders).
2. A chip list of default offsets (`1 day`, `1 hour`, `30 min`, ... — pull
   from company `EntityReminderDefault` if you want it dynamic, or reuse
   `DEFAULT_MEETING_REMINDERS` shape) plus an "add custom" time+unit control,
   writing into `reminders: {time, type}[]`.
3. Only show/enable the reminder section once `remind_at` is set — no anchor,
   no reminders.
4. On submit, omit `reminders` entirely if the user never touched it (so the
   company/global default keeps applying) rather than sending `[]`.

## 6. Open questions for backend before starting

- Should `reminders` UI for each entity load defaults from
  `EntityReminderDefault::forCompanyAndType()` (i.e., an endpoint to fetch
  the company's configured offsets for that entity type) so forms can
  pre-fill the chip list, or is `config('reminders.default')` (1h/30m/15m/5m)
  an acceptable universal placeholder for now? No GET endpoint currently
  exposes `EntityReminderDefault` outside the admin settings page.
- Confirm whether internal Task create/edit (non-API-v2) needs `remind_at`/
  `reminders` wired too, or if Task reminders stay API-v2-only for now.
