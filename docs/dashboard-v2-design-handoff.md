# Dashboard V2 — Design Exploration Handoff

**Audience:** Design (Claude Design / Figma)  
**Product:** HIBARR CRM — real-estate / sales CRM with MLM agent hierarchy  
**Date context:** August 2026  
**Status:** Parallel surface at `/account/dashboard-v2`. Default home is still the legacy Comprehensive Dashboard.

> **Superseded in part.** Sections 3–5 below describe V2 *before* the "Dashboard Redesign" 3a/3b/3c pass. My work, Team and Partner have since been rebuilt against that design and the redesign tokens; Company (leadership) is unchanged. Section 7's code map is current. What the redesign deliberately left out, and why, is listed in §10.

Related domain inventory: [`docs/hibarr-domain-data-inventory.md`](./hibarr-domain-data-inventory.md)

---

## 1. Why you’re here

We need **realistic agent-first dashboard designs** grounded in:

1. What data HIBARR **actually stores and can show**
2. What Dashboard V2 **currently implements**
3. What the **legacy home still does better** for daily agent work
4. Product rules that are **hard constraints** (never invent metrics)

**Important:** The current “My work” (agent) view is a thin exception queue + four counters. It is **not** a good stand-in for how agents should work in the product day-to-day. Use it as a constraint sketch, not the hero concept.

---

## 2. What Dashboard V2 is (product)

Role-scoped **operational** dashboards driven by **honest metrics only**.

| Item | Detail |
|------|--------|
| URL | `/account/dashboard-v2` (`dashboard.v2`) |
| Shell | Title “Dashboard” + optional Segmented switcher |
| Views | Agent → UI label **My work** · Manager → **Team** · Leadership → **Company** · Partner → **Partner** |
| Nav | **Not in sidebar.** Agents still land on legacy `/account/dashboard` |
| Data loading | Server `Inertia::defer` per active view only; switcher = full page visit with `?view=` |
| Access | Independent permissions (`view_agent_dashboard`, etc.). Multi-permission users see a switcher |

### Hard “do not invent” rules (backend product law)

- **No quota / target progress** — no targets in CRM
- **No cost-per-lead / channel ROI** — no spend data
- Prefer **unknown / empty / “—”** over fabricated numbers
- Leadership must not surface **individual agent names**
- Partner is outside trust boundary: **no deal values, no contact PII, no other partners’ data**
- Pipeline value is **per currency only** — exchange rates untrusted; never one global $ total
- Stages only show “stalled” if `target_duration_days` is configured ops-side (often empty today)

---

## 3. Current layout snapshots (as built)

### My work (agent) — ⚠️ weak representation

```
┌─────────────────────────────┬──────────────────┐
│ What needs you first        │ Your numbers     │
│  · Overdue tasks            │  Open deals      │
│  · Hot leads not contacted  │  Won this month  │
│  · Deals past stage target  │  Closing week    │
│                             │  Open tasks      │
└─────────────────────────────┴──────────────────┘
```

**Intent in code:** *“A to-do list that happens to live inside a CRM — not a scaled-down manager view.”* Queue leads; stats are secondary.  
**Reality for design:** Missing almost all daily agent work objects (meetings, open non-overdue tasks, pipeline glance, recent activity, data quality).

### Team (manager)

```
┌ SLA breaches ──────┐ ┌ Stalled deals ─────┐
├ Pipeline by stage ─┤ ┤ Team leaderboard ──┤
```

Exception-first, then funnel + coaching table. **Direct reports only** (parent_agent_id, one level).

### Company (leadership)

```
┌ Month-over-month (leads + won) ────────────┐
├ Pipeline value by currency ┤ Market langs ─┤
└ Lead sources (volume + contact %) ─────────┘
```

Org-wide only; no agent naming.

### Partner

```
┌ Leads you introduced ┤ Your commissions ─┐
```

Referral + commission status totals only.

---

## 4. Data available TODAY in V2 (design with real fields)

### Agent / My work

| Panel | Items / fields | Links to |
|-------|----------------|----------|
| Overdue tasks | `heading`, `days_overdue` | Task show |
| Hot leads not contacted | `client_name`, `temperature` (hot/warm), `waiting_hours` | Lead show |
| Stalled deals | `name`, `stage_name`, `days_in_stage`, `target_days` | Deal show |
| Stats | openDeals, wonThisMonth, closingThisWeek, openTasks | Non-clickable today |

Queue **rank order is product:** already-late work above merely hot work.

### Agent data HIBARR can power that V2 does **not** show yet

Use these for richer agent designs **if** you call them out as “available in domain, not yet in V2 API for this page”:

| Domain object | Realistic fields / UI |
|---------------|------------------------|
| **Meetings / follow-ups** | type, datetime, duration, location/link, participants, status, related lead/deal, reminders |
| **Tasks (full)** | heading, due, priority, board status, assignees, linked lead/deal — not only overdue |
| **Open pipeline** | deal name, stage, value/currency, close date, days in stage, contact name |
| **Recent deals** | name, stage move, last activity |
| **Lead temperature + lifecycle** | cold/warm/hot, lifecycle status, source, first contact SLA |
| **Notes / files / qualification** | activity trail, incomplete quals |
| **Communications** | channel activity on lead/deal (when present) |
| **Data quality** | incomplete contact/deal fields (legacy home has this) |
| **Personal MLM (if agent)** | own level, cycle metrics (NSA/NSD/VSA/VSD), pending commissions — **not** full downline unless manager/partner context |

Legacy home (**ComprehensiveDashboard**) already shows: greeting hero, overview metrics (some clickable), **Meetings panel**, **Tasks & activities**, optional **Data quality**, deal trackers. That is the behavioural baseline agents know today.

### Manager / Team

- SLA breaches: wait hours vs company first-contact SLA (default 24h)
- Stalled deals (team scope)
- Pipeline stages: stage name + count; pipeline selector
- Leaderboard: agent name/avatar, won, lost, open, win rate, avg response hours (null → “—”)

### Company / Leadership

- 12-month trend: leads created + deals won
- Open pipeline $ by currency (count + value)
- Market segments: primary_language (+ large “unknown”)
- Sources: volume + contact rate only

### Partner

- referredLeads, convertedLeads, conversionRate
- commissionsByStatus → amount sums

---

## 5. Gaps: why “My work” fails agents

1. **Discovery** — Not default home; sidebar still goes to legacy
2. **Missing calendar / time work** — no meetings/follow-ups panel
3. **Tasks only as exceptions** — no “today / upcoming”
4. **Stats are dead** — counts don’t navigate into filtered lists (legacy often does)
5. **Hot-only lead queue** — cold backlog invisible
6. **Owner vs agent_id vs tasks** may not match “everything I own”
7. **No mobile density** — desktop 15/9 grid only
8. **Empty states common** until ops configures stage targets / more first-contact stamps
9. **Visual system** is utilitarian Ant Design + slate; **not** the Deals redesign language yet

---

## 6. What to design for (suggested frames)

Prioritize frames that fix agent representativeness:

| Frame | Goal |
|-------|------|
| **Agent home v1** | Replace My work as primary daily surface — queue + **today’s meetings** + **tasks today/soon** + light pipeline glance |
| **Agent action triage** | Better ranked ActionQueue (severity, entity type chips, empty state with next good actions) |
| **Agent pipeline strip** | Open deals / closing this week as navigable, not dead Stats |
| **Team coach** | Manager layout refinement (exceptions → coaching) |
| **Company glance** | Leadership honesty (currency split, unknown language, no CPL) |
| **Partner trust boundary** | Sparse, trustworthy referral + commission statuses |
| **Multi-role shell** | Segmented / mobile switcher, defaults for leadership who also hold agent |

### Example data density for agent mock realism

Use names/stages that feel like real estate sales CRM, not SaaS generic:

- Leads: “Sarah Al-Rashid · Hot · 14h waiting · WhatsApp”
- Deals: “Dubai Marina · Unit A-1204 · Offers · 12d / 7d target”
- Tasks: “Send reservation agreement · 2d overdue · Deal: Palm Jumeirah”
- Meetings: “Strategy call · Tomorrow 10:00 · Zoom · + Lead Maria K.”
- Numbers: Open deals 11 · Won this month 2 · Closing this week 3 · Open tasks 7
- **Do not** invent: quota 80%, CPL $42, channel ROI

---

## 7. Code map (for engineers pairing with design)

```
resources/js/Pages/Dashboard/V2/
  DashboardV2.tsx           shell + switcher + period picker
  dashboard-v2.css          page scope (IBM Plex, tabs, chips)
  types.ts                  prop shapes shared by views + panels
  views/AgentView.tsx       My work
  views/ManagerView.tsx
  views/LeadershipView.tsx
  views/PartnerView.tsx
  components/
    DashboardPanel.tsx      card + note + footer + skeletons
    StatTile.tsx            KPI value + delta + sparkline
    NextUp.tsx              the top three
    FullQueue.tsx           grouped/filterable remainder
    TodaySchedule.tsx       today + tomorrow's meetings
    StageFunnel.tsx         horizontal count bars
    LifecycleFunnel.tsx     created → contacted → met → deal → won
    ResponseDistribution.tsx
    LeaderboardTable.tsx    per-agent table
    SourceBreakdown.tsx
    PartnerTrendChart.tsx
    ReferralTable.tsx
    TrendLine.tsx           recharts (leadership only)

app/Http/Controllers/DashboardV2Controller.php
app/Services/Dashboard/DashboardMetricsService.php

Compare (legacy agent baseline):
resources/js/Pages/Dashboard/ComprehensiveDashboard.tsx
app/Http/Controllers/DashboardController.php → dashboardOverview()
```

---

## 8. Decision questions for design + product

1. Should V2 **My work become default home** or stay a secondary “exceptions” mode?
2. What minimum agent home must include before replacing ComprehensiveDashboard?
3. Show MLM self-stats on agent dashboard or keep pure sales/work?
4. Multi-role default: open **My work** or **Company** for leadership+agent?
5. Visual direction: **quiet ops (current)** vs **Deals redesign** tokens/primitives?

---

## 9. One-paragraph elevator for a design session

HIBARR Dashboard V2 is a four-role operational dashboard (My work / Team / Company / Partner) built on honest CRM metrics—no quotas, no spend/ROI. The agent “My work” view is currently only a ranked exception queue (overdue tasks, hot uncontacted leads, stalled deals) plus four passive counts. Real agent work in production still lives on the legacy home: meetings, full tasks, metrics, data quality. Domain data can support richer agent home designs (follow-ups, pipeline, temps, commissions); designs should expand “My work” into a realistic daily surface without inventing unavailable BI.

---

## 10. Redesign 3a/3b/3c — what shipped, and what is still missing

The six gaps listed in the first pass have since been closed. What follows is the current state.

### Now built

| Element | How |
|---|---|
| **Log activity + next step** (3a) | The existing CRM-events `LogActionModal` gained an optional next-step block. "Next step" is `tasks.is_next_step` — a flag on the task the agent nominated, not a new field on the lead or deal, so overdue work stays one source of truth. |
| **Complete / Reschedule** (3a) | Complete posts `tasks.change_status`. Reschedule posts a new `tasks.reschedule`, which touches only `due_date` — routing it through `tasks.update` would resend heading, priority and assignees from a possibly stale snapshot and silently revert a concurrent edit. |
| **Row actions open real modals** (3a) | Task rows open `TaskDetailModal`, meeting rows open `MeetingDetailModal` + `RescheduleMeetingModal`, Add lead opens `SaveLeadModal`. All pre-existing components; the dashboard supplies its own hooks because the `useDeal*`/`useLead*` ones throw outside their workspace providers. |
| **"Records with no next step"** (3a) | A fourth queue bucket, replacing the design's "Coverage check" modal. This is the signal that actually fires — `stalledDeals` reads `pipeline_stages.target_duration_days`, which is NULL on every stage, so that bucket is permanently empty by design. |
| **Meetings "held"** (3b) | `lead_follow_up.status` is now writable: `changeFollowUpStatus` gained validation, a permission check and a null-deal guard (it raised a TypeError on all 28 lead-only follow-ups), and the bulk path stopped writing a `completed_at` column that does not exist. A "Mark held" action appears on past meetings. |
| **Median days in stage** (3b/3a) | Read from `crm_events.deal_stage_changed`, which has ~150 rows against `deal_histories`' 2. Closed dwells (event → next event) and open dwells (`stage_entered_at` → now) are reported separately and never mixed — an open dwell is right-censored. |
| **Commission forecast** (3c) | `MlmCommissionService::preview()` extracted as the pure half of `distribute()`, which is now a persist loop over it. See the caveat below. |
| **Flag to partner manager** (3c) | `partner_flags` table, a `manage_partner_flags` permission on the existing dashboards module (no new role), a manager queue on the Team view and a reply that the partner sees on their referral row. |

### Root causes fixed along the way

- `DealHistoryTrait::createDealHistory()` called `user()->id` with no null guard. In `DealObserver::updating` that exception propagated out and **aborted the whole save**, so any stage change made by a queue job, console command or import lost the change as well as the history row.
- `DealController::changeStage` and `DealContactApiController` mass-updated `pipeline_stage_id` past the observer, so those deals never stamped `stage_entered_at` and never emitted a stage event.
- Meeting attendee lists silently dropped deactivated users (`ActiveScope`), rewriting who was in the room.
- The agent queue reported the number of rows it shipped rather than the true total — an agent with 85 overdue tasks was told 25.

### Still not built, and why

| Element | Why |
|---|---|
| **Snooze** (3a) | Snoozing is rescheduling with the reason hidden, and nothing in the schema records "hidden until". Reschedule expresses the same intent honestly. |
| **Network average conversion** (3c) | Cross-partner comparison; outside the trust boundary. |
| **"What converts for you" by destination** (3c) | No destination or project field on leads. `category_id` is populated on 9 of 43 rows and is not the same concept. |
| **"Refer a client" button** (3c) | No partner-scoped lead-create flow; `referred_by_agent_id` is set elsewhere. |
| **Pipeline-stage funnel replacing the lifecycle funnel** (3b) | The lifecycle funnel is still the honest one — its five steps each rest on a populated timestamp. Stage dwell is now shown per stage on the agent's pipeline panel instead. |

### Two things the UI states rather than hides

1. **Meetings "held" has a cutover date.** `DashboardMetricsService::STATUS_TRUSTED_FROM` is the deploy date. Before it, `status` was never written through a working path, so held is read as past-and-not-cancelled; from it, only an explicit "Mark held" counts. Expect the meetings KPI to read low for a few weeks while agents learn the button — the panel note says which side of the line it is reading.
2. **The commission forecast returns zero today, and is not broken.** `distribute()` pays `deals.agent_id` and their `agent_hierarchy` ancestors and never reads `leads.referred_by_agent_id` — referral is not a concept the commission engine has — and `agent_hierarchy` is empty, so upline legs pay nothing regardless. The tile renders an em dash with "Awaiting commission setup". It starts producing real numbers the day referral attribution reaches the engine, with no further dashboard work. Below three open referred deals the figure is suppressed anyway, because a partner knows their own rate and could back-derive a deal value.

### Funnel steps are not strictly nested

A deal can be created with no meeting ever logged, so a later step can exceed an earlier one. Bars scale to the largest step and the panel says so rather than drawing a tidy lie.
