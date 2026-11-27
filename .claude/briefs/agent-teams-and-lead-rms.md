# Agent teams & lead relationship managers

**Date:** 2026-11-27
**Scope:** `hibarr-crm` — record visibility for leads, deals, tasks, calls, meetings
**Branch:** `feat/agent-teams-visibility` (per CLAUDE.md naming; do not use auto-generated names)
**How to use:** prompt against this file, e.g. "Implement Phase 1 of `.claude/briefs/agent-teams-and-lead-rms.md`". Build Phases 1–6 in order; Phase 7 is rollout/verification only.

## Goal

Add two new ways to be granted access to a record, without changing who can see what for anyone who is in neither:

1. **Agent teams** — members see teammates' leads/deals/tasks/calls/meetings according to team visibility settings; a **team lead** sees and edits all of them regardless of those settings.
2. **Lead relationship managers (RMs)** — users assigned to a lead get the same access as the lead owner, dynamically extended to everything hanging off that lead.

Teams are **not** MLM (`lead_agents.parent_agent_id` / `agent_hierarchy`, commission-oriented) and **not** the HR `Team` model (department). New tables, new names.

## Decisions (agreed)

| # | Decision |
|---|----------|
| 1 | Team access **never overrides role permission**. Role `none` stays `none`. |
| 2 | Team lead: view + edit all five entities for all members (still bounded by role `edit_*`). Members: view/manage is **opt-in**, set per team default and overridable per member. RMs can edit. |
| 3 | A teammate's record = they **own or are assigned** to it (not merely `added_by`). |
| 4 | RM access is **derived dynamically** (no copying into `deal_participants`). |
| 5 | One team per user. No sub-teams. |
| 6 | Members see their team lead's records when the level is ≥ `view`. |
| 7 | A team may exist with **no lead**, at creation and afterwards. Nothing blocks removing/deactivating the last lead. |
| 8 | Visibility does **not** change personal KPIs/commissions ("mine" stays "mine"). |
| 9 | Commission visible to: agent, participants, admins (today) **plus** team lead and the lead's RMs. Watchers stay excluded. |
| 10 | Partners **may** be team members and team leads. `/agent` workspace is **out of scope for now**. |
| 11 | Calls/recordings need no extra gate — whoever can see the lead sees them. |
| 12 | Notifications: RMs get key events (owner change, new inbound activity, SLA breach); team leads get none unless they opt in per user. |
| 13 | Assignment pools stay independent of teams. MLM stays fully separate. |
| 14 | RMs can be assigned by automations. Automation action has a "can see commission" toggle, **default off**. |
| 15 | Team lead may reassign records, **only to members of their own team**. |
| 16 | Leaving a team removes access immediately; records and history are untouched. |
| 17 | RM "edit" = `edit_lead` + child records. Delete and owner transfer stay owner/admin-only. |
| 18 | Saved views: existing `visibility = 'team'` is renamed **`global`**; new **`team`** = "shared with my agent team". |
| 19 | Audit everything (`AuditLog`); RM changes also get `CrmEvent` timeline entries; admins get a "why can I see this?" panel. |

## What exists today (verified)

- Visibility = `view_*` permission scope (`all|added|owned|both|none`) via `PermissionService::applyScope` / `checkAccess`, but the rules are **duplicated**: ~30 `'owned' => 'lead_owner'` arrays, ~12 inline `where('lead_owner', user()->id)`, ~24 deal `whereHas('leadAgent')` closures. Also hand-rolled in `LeadService::applyPermissionScope`, `Lead::allLeads`, `MeetingVisibilityService::schedulableLeadsQuery`, `Email/Matching/LeadVisibility`.
- Deal ownership is `deals.agent_id` → `LeadAgent` (not a user), plus `deal_participants` (agent-equivalent rights) and `deal_watchers` (view-only). Lead ownership is `leads.lead_owner` → user.
- Tasks and meetings use `visibleToUser` (creator/assignee/participant), not `view_*` scopes the same way. Meeting/follow-up participants are a **JSON column** (`whereJsonContains`). Tasks mix `view_tasks` rules (`TaskVisibilityService`) with `Task::scopeVisibleToUser`.
- Calls are `crm_events` rows scoped via lead/deal (`CallLogService::leadScope`, `lead_ids`/`deal_ids`). `CallRecordingController` authorizes via `view_lead`/`view_deals`.
- Saved views (`LeadSavedView`, `TaskSavedView`, `MeetingSavedView`) share via `visibility = 'team'` meaning "everyone in the company" today.
- Reminders/notifications key off `lead_owner` directly (`AutoFollowUpReminderListener`, `LeadObserver`).

## Architecture

One resolver, many grant paths.

```
RecordVisibility (scoped service, memoised per request)
  forUser(User $viewer, Entity $entity, Ability $ability /* view|manage */): VisibilityGrant
    - effectiveUserIds: int[]   // viewer + teammates whose records the viewer may see at this ability
    - viaRelationshipManager: bool (EXISTS subquery on lead_relationship_managers for the viewer)
    - bypass: all|none          // from role permission 'all' / 'none'
```

Resolution order (document it in the class docblock; no surface may invent its own):

1. Role permission (`view_*` / `edit_*`). `none` → deny. `all` → allow.
2. Grant path: owner/assignee/agent/participant → RM → team lead → team member.
3. Ability: a `view` grant satisfies the `owned` predicate for `view_*` only; `manage` also satisfies `edit_*`.
4. Field masking (commission — see Phase 5).

Rule arrays that today say `where(owner, $user->id)` become `whereIn(owner, $grant->effectiveUserIds)` plus the RM clause. Existing public signatures (`PermissionService::applyScope/checkAccess`) are kept and call the resolver internally so un-migrated callers keep working.

## Data model

```
agent_teams
  id, company_id, name, added_by, last_updated_by, timestamps
  leads_level, deals_level, tasks_level, calls_level, meetings_level   -- enum hidden|view|manage, default hidden

agent_team_members
  id, company_id, team_id, user_id, role (lead|member),
  leads_level, deals_level, tasks_level, calls_level, meetings_level   -- nullable override; null = inherit team default
  timestamps
  UNIQUE (company_id, user_id)      -- one team per user
  INDEX  (team_id, role)

lead_relationship_managers
  id, company_id, lead_id, user_id, assigned_by, source (manual|automation),
  can_see_commission boolean, timestamps
  UNIQUE (lead_id, user_id)
  INDEX  (user_id), INDEX (company_id, lead_id)

saved views (lead/task/meeting): `visibility` gains value 'global'; 'team' repurposed
  + team_id nullable (set when visibility = 'team')
```

Effective level for a member viewing a teammate: `member override ?? team default`. Lead role ⇒ `manage` always. Overrides can loosen or tighten.

New permissions (seeded via `Module::MODULE_LIST` + backfill migration, same shape as `2026_09_05_000001_add_team_dashboard_permission.php`): `manage_agent_teams`, `manage_lead_relationship_managers`.

New enum: `App\Enums\TeamVisibilityLevel { Hidden, View, Manage }`. Feature flags (`config/features.php`): `crm.agent-teams`, `crm.lead-relationship-managers`.

## Phases

### Phase 0 — Verification spikes (no code)

Short read-only checks that could change later phases. Record findings at the bottom of this file.

- [ ] Read `tests/Feature/Partners/RestrictPartnerAccountsTest.php` and the partner restrictions it enforces — confirm partner **team lead** access doesn't contradict them (Decision 10).
- [ ] Inventory deal payload fields that carry commission/package/referral terms (Phase 5 masking list). Earlier grep found masking mostly around MLM levels and developer projects, not deal fields.
- [ ] Check `LeadUserNote` purpose (pivot `user_id`/`lead_note_id`; not confirmed to be "private notes").
- [ ] Confirm whether the top-level call-log list (`TelephonyCallLogController@index` passes `null` scope = whole company) is gated elsewhere. If not, it is a pre-existing gap — fix in Phase 1 or raise separately.
- [ ] Confirm whether a meeting **host** who isn't creator/participant is visible to themselves (`DealFollowUp::scopeVisibleToUser` checks `added_by` + `participants` only).
- [ ] List every call site for Phase 1 (grep matrix: controllers, DataTables, services, dashboards, exports, email matching, `AgentSearch`, `CallerGlance`, `TaskBoard/Calendar`, `RecurringTask`).

**Exit:** findings written down; any contradicting decision escalated before Phase 1.

### Phase 1 — Centralise visibility (no behaviour change)

Goal: every surface asks one resolver; output is byte-identical for users who have no team and no RM.

- [ ] `app/Services/Visibility/RecordVisibility.php` (+ `VisibilityGrant`, `Entity`, `Ability` enums). Bind `scoped` in a service provider.
- [ ] Characterization tests first: for each entity × permission scope (`all|added|owned|both|none`), snapshot which fixture records are visible today. These must pass before and after the refactor.
- [ ] Re-point `PermissionService::applyScope`/`checkAccess` to the resolver (keep signatures).
- [ ] Migrate lead call sites: `LeadService::applyPermissionScope`, `Lead::allLeads`, `LeadContactController` rule arrays, `LeadBoardController`, `LeadContactDataTable`, `LeadReportController`, `MeetingVisibilityService::schedulableLeadsQuery`, `Email/Matching/LeadVisibility`, `TelephonyCallLogController@lead`, `CallRecordingController`.
- [ ] Migrate deal call sites: `DealController` (index, show, update, notes, summary…), `DealsDataTable`, `DealSummaryController`, `DealNoteController`, `DealPaymentController`, `MeetingVisibilityService::schedulableDealsQuery`, `Deal::hasTeamMemberAccess/isVisibleToUser`.
- [ ] Migrate task call sites: `Task::scopeVisibleToUser`, `TaskVisibilityService`, `TaskController`, `TaskBoardController`, `TaskCalendarController`, `RecurringTaskController`, `TasksDataTable`, `ArchiveTasksDataTable`, `RecurringTasksDataTable`.
- [ ] Migrate meeting call sites: `DealFollowUp::scopeVisibleToUser`, `MeetingsController`, `MyCalendarController`, `DashboardController`, `DashboardMetricsService` (visibleToUser usages).
- [ ] Migrate call surfaces: `CallLogService::leadScope`, `TelephonyCallController`, `TelephonyCallLogController`.
- [ ] Guard test (architecture test): fail if new code outside the resolver contains `'owned' => 'lead_owner'` or `where('lead_owner', user()->id)`.
- [ ] Participant lookup for meetings/follow-ups: introduce the abstraction (`participantIds`) behind the resolver so Phase 4 can swap JSON for a pivot without touching callers. Do **not** change storage yet.
- [ ] Run `vendor/bin/pint`, `vendor/bin/phpstan analyse`, full `php artisan test`.

**Exit:** characterization suite green, guard test green, no diff in visible-record sets for any fixture.

### Phase 2 — Lead relationship managers

- [ ] Migration + model `LeadRelationshipManager` (`HasCompany`), `Lead::relationshipManagers()`.
- [ ] Resolver: RM clause on lead; derive to the lead's deals, tasks, meetings, calls, recordings, notes, files, communication activity via the lead link. RM satisfies the `owned` predicate for both `view_lead` and `edit_lead` (and child-entity equivalents). Role `none` still denies.
- [ ] Permission `manage_lead_relationship_managers` + backfill migration; who may assign: lead owner, users with the permission, admins.
- [ ] `LeadRelationshipManagerController` (add/remove) returning JSON; hook `useLeadRelationshipManagers` (action + `saving`/`loading`, patches local lead state — no Inertia reload, per CLAUDE.md).
- [ ] Lead detail redesign: RM picker in header/owner area built on shared pickers in `Components/Redesign/primitives` (check `DealPeoplePicker` pattern first); deferred prop for RM list; skeleton fallback.
- [ ] Dedupe rules: owner is not shown as an RM; changing owner to an existing RM removes the RM row; lead merge unions RMs (`LeadMerged` path); lead→deal conversion needs no copy (derived).
- [ ] Notifications: RMs receive owner change, new inbound activity, SLA breach. Reuse the existing notification settings table.
- [ ] Audit: `AuditLog` entries + `CrmEvent` timeline entry on add/remove.
- [ ] Automations: new `assign_relationship_manager` action in lead automations (`LeadAutomationAction`) and deal automations where applicable; `source = automation`; toggle `can_see_commission` (default off). Update `AutomationFieldCatalog`.
- [ ] Bulk actions: bulk "add RM" in lead list (`LeadContactController` bulk update) with per-row permission check.
- [ ] i18n: lang keys in `eng/de/tr/ru`, bump `I18N_DICT_VERSION`.
- [ ] Tests: RM sees/edits lead and children; RM with role `none` sees nothing; RM cannot delete or transfer; merge/dedupe; automation-assigned RM without commission toggle.

**Exit:** RM works end-to-end behind `crm.lead-relationship-managers`.

### Phase 3 — Teams: data model, admin settings, saved-view rename

- [ ] Migrations + models `AgentTeam`, `AgentTeamMember` (+ `TeamVisibilityLevel` enum, casts). Name must not collide with existing `Team`.
- [ ] Permission `manage_agent_teams` + backfill migration.
- [ ] `AgentTeamController` (CRUD, add/remove members, set role, set overrides). Validation: one team per user; partners allowed; lead optional.
- [ ] Observer on `User` deactivation (`UserObserver` already handles `deactive`) to drop the membership; no blocking, warn in UI if team ends up leaderless.
- [ ] Settings page under the settings hub: team list, team detail with five visibility selects (default `hidden`), member table with role + per-entity override (inherit/hidden/view/manage). Redesign tokens + shared `Button`/`Modal`/pickers; client-side state, no reloads; i18n in four languages.
- [ ] Leaderless banner for admins.
- [ ] Saved-view rename (**ship together**):
  - migration: `visibility = 'team'` → `'global'`; add `team_id`.
  - `LeadSavedView`/`TaskSavedView`/`MeetingSavedView`: `VISIBILITY_GLOBAL`, repurposed `VISIBILITY_TEAM`; update `scopeVisibleTo`, `canSetVisibility`, admin rules.
  - Filters UI (`SaveViewPopover`, `SavedViewsDrawer`, `ViewsBar`, `useLeadSavedViews`, `EntityFilterModal`) labels/options; Meetings pages.
  - A "team" view is visible to members of that `team_id` only.
- [ ] Audit: team/member/override changes to `AuditLog`.
- [ ] Tests: unique membership, partner member/lead, deactivation, leaderless team, saved-view migration preserves existing shares as `global`.

**Exit:** teams can be configured and saved views renamed; no visibility effect yet.

### Phase 4 — Team clauses on every surface

- [ ] Resolver: add team grant. Lead → `manage` on all five entities for all members. Member → effective level per entity for teammates' own/assigned records. Members see their lead's records at ≥ `view`. Role permission still gates; `view` satisfies `view_*` only; `manage` also `edit_*`.
- [ ] Team lead reassign: allowed only to members of the lead's own team (validate in lead/deal/task reassign endpoints and bulk owner change).
- [ ] Replace meeting/follow-up JSON participants with a pivot (or generated column) + backfill, so the N-teammate `whereJsonContains` OR isn't a hot path. Keep the Phase 1 abstraction.
- [ ] Index review: `agent_team_members(company_id,user_id)`, `lead_relationship_managers(user_id)`, owner columns used in `whereIn`.
- [ ] Surface checklist (each: list, detail, board/calendar, search, export, dashboard "visible" widgets, API): leads, deals, tasks, meetings, calls, recordings, email attach (`LeadVisibility`), global search (`AgentSearch` — main app only; `/agent` stays out of scope).
- [ ] Reports/dashboards: three scopes — "mine" (KPIs, commissions: unchanged), "visible to me", "team". Update `AgentReportScope`, `LeadMetricsService`, `DashboardMetricsService`. MLM `view_team_dashboard` untouched.
- [ ] API tokens: inherit the owner's resolver result; **no** new token scope.
- [ ] Saved views with `team` visibility resolve per viewer.
- [ ] Left-team behaviour test: access disappears immediately, records and history stay.
- [ ] Tests: full entity × surface × role matrix (lead / member@view / member@manage / member@hidden / outsider / RM / role-none / partner member).

**Exit:** matrix green; no regressions for users outside teams/RMs.

### Phase 5 — Commission masking, UI affordances, audit

- [ ] `canSeeCommission(viewer, deal)`: true for agent, participants, admins (and roles that already see it today) **plus** team lead (of the agent's team) and RMs of the deal's lead (honouring `can_see_commission`); false for watchers and everyone else. Apply where deal payloads/Inertia props are built, once. Field list from Phase 0.
- [ ] Badges: "via team" / "via RM" on records; read-only state when only `view`; disabled edit affordances.
- [ ] Admin "why can I see this?" panel: lists grant path(s), team + effective level, RM row.
- [ ] Timeline entries for RM changes; audit-log filters for team/RM events.
- [ ] Team-lead opt-in notifications (per user).
- [ ] Tests: commission masking per viewer type; automation-RM without toggle sees lead but not commission.

**Exit:** no commission leakage path; users can see why they have access.

### Phase 6 — Hardening

- [ ] Performance: query counts and plans for lead list / deal list / task board with 50-member team; resolver memoisation; no N+1 from RM `EXISTS`.
- [ ] Permission-edge tests: role downgrade mid-session, member removal mid-session, owner change while viewing.
- [ ] Data safety: confirm default `hidden` produces zero behaviour change for existing companies (diff visible-record sets on a production-like dataset).
- [ ] Docs: update `CLAUDE.md`/`AGENTS.md` visibility section (single resolver rule); add user-facing help for teams/RMs.
- [ ] Lint/static: Pint, PHPStan, full test suite.

### Phase 7 — Rollout (verification only)

- [ ] Enable `crm.lead-relationship-managers` per environment, then `crm.agent-teams`; saved-view rename migration ships with `crm.agent-teams`.
- [ ] Pilot one company: create a team, run through the matrix manually (lead, member, RM, partner member).
- [ ] Monitor: 403 rates, slow queries on list endpoints, support tickets about "can't see X".
- [ ] Rollback plan: flags off ⇒ resolver ignores team and RM grants; tables remain.

## Out of scope (for now)

- `/agent` workspace (`AgentSearch`, `CallerGlance`, `ContactDeals` workspace flows).
- Sub-teams, multi-team membership.
- Commission or MLM changes of any kind.
- Lead assignment pool changes; auto-assigning RMs from pools.
- Separate recording gate (Decision 11).

## Risks to watch

- Missed call site ⇒ visibility gap or leak. Mitigation: guard test + matrix.
- JSON participant queries at team scale. Mitigation: pivot in Phase 4.
- Saved-view rename shipped without the new scope ⇒ shared views silently narrow. Ship together.
- Partner team leads see teammates' commission (accepted, Decision 9/10) — confirm with `RestrictPartnerAccountsTest` in Phase 0.

## Phase 0 findings

_(fill in during Phase 0)_
