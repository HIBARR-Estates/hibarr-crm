# Dashboard V2 — Design Exploration Handoff

**Audience:** Design (Claude Design / Figma)  
**Product:** HIBARR CRM — real-estate / sales CRM with MLM agent hierarchy  
**Date context:** August 2026  
**Status:** Parallel surface at `/account/dashboard-v2`. Default home is still the legacy Comprehensive Dashboard. V2 is data-honest and functionally built, **visually unfinished** — not the agent product representation design should ship against.

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
  DashboardV2.tsx           shell + switcher
  views/AgentView.tsx       My work
  views/ManagerView.tsx
  views/LeadershipView.tsx
  views/PartnerView.tsx
  components/
    DashboardPanel.tsx      card + note + skeleton
    ActionQueue.tsx         ranked lists
    StageFunnel.tsx
    LeaderboardTable.tsx
    TrendLine.tsx           recharts
    SourceBreakdown.tsx

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
