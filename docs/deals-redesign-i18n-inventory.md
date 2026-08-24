# Deals Redesign — i18n Audit Inventory

Audit of translation defects on the redesigned Deal page. Defect classes:

- **hardcoded** — plain English, not wrapped in `t()` or `td(..., { source: "en" })`
- **missing_t_key** — `t()` key absent from lang files (fallback English in code)
- **td_miswire** — `td()` called without `{ source: "en" }` on product English

Locales updated: `eng`, `de`, `ru`, `tr` (`resources/lang/*/pages.php`).

---

## Header & pipeline

| Location | Original string | Defect class | Fix applied |
|----------|-----------------|--------------|-------------|
| `DealPipelineStepper.tsx` | `Open` / `Done` fallbacks | missing_t_key | Added `pages.deals.header.pipeline.open_field`, `requirement_done`; removed fallbacks |
| `DealPipelineStepper.tsx` | Operator labels (`is`, `contains`, …) | hardcoded | `td(..., { source: "en" })` at render |
| `DealPipelineStepper.tsx` | `humanizeField()` output | hardcoded | `td(..., { source: "en" })` at render |
| `DealPeoplePicker.tsx` | Employee directory empty states | missing_t_key | Added `pages.deals.header.team.employees_*`; removed inline fallbacks |
| `useDealOutcome.ts` | Outcome toast messages | td_miswire | Added `{ source: "en" }` to all `td()` calls |

---

## AI summary (redesign variant)

| Location | Original string | Defect class | Fix applied |
|----------|-----------------|--------------|-------------|
| `EntityAiSummaryHeader.tsx` | Generating, empty prompt, risk, stale, fallback, timestamps | hardcoded | `t("pages.entity_summary.*")` (redesign only) |
| `EntityAiSummaryHeader.tsx` | `statusLine`, chip preview | hardcoded (API) | `td(..., { source: "en" })` |
| `EntityAiSummaryCard.tsx` | Retry, Refresh, banners, regenerate labels | hardcoded | `t()` (redesign only) |
| `EntityAiSummaryCard.tsx` | Bullets, API errors | hardcoded (API) | `td(..., { source: "en" })` |
| `AiThinkingIndicator.tsx` | Loading phrases (panel) | hardcoded | `t("pages.entity_summary.thinking.0–10")` |
| `EntityAiSummaryNextStep.tsx` | Suggested next step, manual step | hardcoded | `t()` + `td()` for label/rationale |
| `EntityAiSummaryChipGrid.tsx` | Chip label/value/sublabel | hardcoded (API) | `td(..., { source: "en" })` |
| `summaryActions.ts` | Button labels | hardcoded | `nextStepButtonLabel(nextStep, t)` |
| `useEntityAiSummary.ts` | 429 / generic errors | hardcoded | `t("pages.entity_summary.error.*")` |

---

## Workspace tabs & hooks

| Location | Original string | Defect class | Fix applied |
|----------|-----------------|--------------|-------------|
| `useDealMeetingCreate.ts` | Meeting validation + schedule failure | hardcoded | `t("pages.deals.workspace.meetings.validation.*")`, `messages.schedule_failed` |
| `useDealMeetingReschedule.ts` | Date/time validation, reschedule failure | hardcoded | Same meetings validation/messages keys |
| `useDealMeetingUpdate.ts` | Update failure | hardcoded | `messages.update_failed` |
| `DealEditMeetingModal.tsx` | Meeting validation | hardcoded | Same meetings validation keys |
| `useDealNoteCreate.ts` | Note validation / save failure | hardcoded | `notes.validation.details_required`, `messages.save_failed` |
| `useDealTaskCreate.ts` / `useDealTaskUpdate.ts` | Task title required, failures | hardcoded | `tasks.validation.title_required`, `messages.*_failed` |
| `useDealProposalCreate.ts` | Property/amount required, save failure | hardcoded | `offers.validation.*`, `messages.save_failed` |
| `useDealFileUpload.ts` | Save failure | hardcoded | `files.messages.save_failed` |
| `WorkspaceTasksTab.tsx` | `Untitled task`, select/open aria | hardcoded | `t("pages.deals.common.*")` |
| `WorkspaceMeetingsTab.tsx` | Select/open meeting aria, location display | hardcoded | `t("pages.deals.common.*")`, `td(locationDisplay)` |
| `WorkspaceOffersTab.tsx` | Loading offers aria | hardcoded | `offers.loading_aria` |
| `WorkspaceFilesTab.tsx` | Delete confirm, `recently` fallback | hardcoded | `files.delete_confirm_message`, `common.recently` |
| `WorkspaceItineraryTab.tsx` | Empty hint (English used as key) | missing_t_key | `pages.flight_itinerary.empty_hint` |
| `WorkspaceRecommendationsTab.tsx` | `N/A`, specs meta line | hardcoded | `common.not_available`, `td()` on meta parts |
| `overviewShared.tsx` | `Cancel` | hardcoded | `pages.deals.common.cancel` |

---

## Analysis modal

| Location | Original string | Defect class | Fix applied |
|----------|-----------------|--------------|-------------|
| `AnalysisScrollPanel.tsx` | Empty analysis steps copy | hardcoded | `td(..., { source: "en" })` |
| `AnalysisSectionBlock.tsx` | Section title / guide text | hardcoded (server) | `td(..., { source: "en" })` |
| `AnalysisSectionNavigator.tsx` | Section nav titles | hardcoded (server) | `td(..., { source: "en" })` |
| `DealAnalysisModal.tsx` | Dismiss aria | hardcoded | `pages.deals.common.dismiss` |
| Analysis inputs (`PhoneInput`, `Country*`, `Currency*`, `PasswordInput`, `FileInput`, `NumberRangeInput`) | Placeholders, Min/Max, empty states | hardcoded | `td(..., { source: "en" })` |

---

## Deal info & timeline

| Location | Original string | Defect class | Fix applied |
|----------|-----------------|--------------|-------------|
| `DealInfoSectionPanel.tsx` | GDPR consent description | td_miswire | Added `{ source: "en" }` |
| `DealTimelineEventRow.tsx` | Event title fallbacks | td_miswire | Added `{ source: "en" }` |
| `DealTimelineEventEditModal.tsx` | Event title | td_miswire | Added `{ source: "en" }` |

---

## Manual QA checklist

For each locale **de**, **ru**, **tr** (plus **en** regression):

1. Load redesigned Deal page — header, pipeline, AI summary, tab bar
2. Walk every tab: Overview, Notes, Tasks, Meetings, Files, Offers, Recommendations, Itinerary, Deal info, Timeline
3. Open dossier rail; expand Lead / Deal details / Documents
4. Open actions menu; trigger validation errors (empty task, empty note, incomplete meeting form)
5. Open Deal Analysis modal; check empty state, input placeholders
6. Confirm no raw i18n keys (e.g. `pages.deals.header.pipeline.open_field`) and no unwrapped product English
7. AI summary: generate/refresh; confirm chrome + payload translate (brief English flash during `td()` resolve is expected)

---

## Out of scope (unchanged)

- Dynamic translation engine (`resources/js/lib/dynamicTranslation.ts`)
- Legacy `EntitySummary` variant (`variant !== "redesign"`)
- Unused `useDealStageFocus.ts`
- User-generated content (deal names, note bodies, lead names)
- Internal section IDs used as React keys (`"Lead"`, `"Past"` in dossier rail)
