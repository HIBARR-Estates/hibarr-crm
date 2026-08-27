# Lead Automation Engine — Architecture Decision

## Decision

**Duplicate a Lead-specific automation stack (`LeadAutomation*`) rather than generalizing `DealAutomationService`.**

Shared helpers are used where useful (condition evaluation operators, Plunk header attachment pattern, existing create paths for tasks/meetings/notes). The live Deal automation execution path is not rewritten.

## Rationale

1. **Isolate live Deal behavior.** Deal automations are pipeline-scoped and Deal-typed end-to-end. A generalize-in-place rewrite would touch production Deal execution during a multi-sprint Lead feature.
2. **Scoping differs.** Deal rules key off `pipeline_id`. Lead rules are **company-scoped** (`company_id`) and narrowed via conditions/triggers — not pipelines.
3. **Feature flag clarity.** `crm.lead-automation-engine` gates Lead trigger evaluation only. Deal automations remain unaffected regardless of flag state.
4. **Action set differs.** This pass adds Lead-only actions (`create_task`, `create_meeting`, `create_note`, `send_email`). Deal keeps `stage_transition` / `set_field_value` / `lock_deal`.

## Explicit non-goals / callouts

| Topic | Decision |
|-------|----------|
| Lead lock | **N/A** — Leads have no `is_locked` / lock-skip analog. Do not invent one. |
| Admin UI | **Out of scope** this pass. Config via factories/seeders/tests until a follow-up ticket. |
| Qualification | Fire trigger `qualification_completed` only. Do **not** implement `QualificationActionCatalog` coming-soon actions. |
| Email templates | Resolve via `ReminderEmailTemplate::plunkTemplateId($companyId, 'lead')`. No raw Plunk IDs in action payload. |
| Email recipients | Payload-configurable: `client`, `owner`, both, plus optional `user_ids`. Log-and-continue on failures. |
| UNS/Plunk | Reuse existing mail transport + Plunk headers; no new integration code. |

## Flag

- Name: `crm.lead-automation-engine`
- Staging: ON; Production: OFF at launch
- Cleanup: remove after ~2 weeks stable post first end-to-end Lead automation in production

## Triggers

| Trigger | Source |
|---------|--------|
| `lead_created` | `LeadObserver::created` |
| `lead_updated` | `LeadObserver::updated` |
| `custom_field_updated` | After Lead custom-field writes |
| `qualification_completed` | `LeadQualificationService::complete()` |
