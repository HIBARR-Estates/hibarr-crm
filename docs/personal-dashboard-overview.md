# Personal Dashboard — How It Works

The default landing page behind `crm.personal-dashboard` (`Dashboard/V2/PersonalDashboard.tsx`, served by `DashboardV2Controller::personalDashboard()`). Scoped to one person — not a team or company rollup. Everyone gets this first; holding a `view_*_dashboard` permission only adds a "Team" switcher into the role-scoped views, it doesn't replace this page.

Every panel is deferred (`Inertia::defer`) and grouped so the shell paints immediately — see the group names below, each is its own follow-up request.

## Panels, top to bottom

1. **Header** (`StatusLine.tsx`) — a greeting, one summary sentence built from live queue/pipeline counts (or "Nothing needs you right now." when both are genuinely empty), and a schedule line (calendar item count + next meeting time). The "My work / Team" toggle sits here; Team is currently disabled.

2. **Stat strip** (`StatStrip.tsx`) — four cards, always all four:
   - **Leads** — new / contacted / uncontacted.
   - **Deals** — open count + value, idle-deal chip.
   - **Meetings** — meeting count + tasks-done ratio.
   - **Commission** — earned this month, vs-last-month chip, pending payout.

3. **"Needs your attention"** (`SignalQueue.tsx`) — your task queue, sectioned Overdue / Due today / Later, each row carrying the lead/deal it hangs off plus inline Complete/Reschedule/Log-activity actions. Footer line: records with no next step set.

4. **"Open deals by pipeline"** (`PipelineSplit.tsx`) — one bar per pipeline, ranked by value (highest first). Bar length is a share of your single largest pipeline, not a completion target. Shows deal count, value, and idle-for-7-days count per pipeline.
   - `Activity on your records` used to sit beside this panel. It's hidden for now (not useful in its current state) — see the commented-out `recentActivity` prop in `DashboardV2Controller.php` to bring it back.

5. **Agenda rail** (`AgendaTimeline.tsx`) — upcoming meetings strictly ahead of "now," sorted chronologically. Tasks are never duplicated here even if they have a due time — they live in the queue panel only.

## Time scope

There's no single window — one shared 7-day constant plus a few pieces that are deliberately unbounded.

`DashboardMetricsService::PERSONAL_WINDOW_DAYS = 7` is the shared default. It's shipped to the frontend as `windowDays` so the copy and the queries can't drift apart.

| Panel / metric | Scope |
|---|---|
| Queue — due today / later | `due_date` between now and **+7 days** |
| Queue — **overdue** | Unbounded backward — a task 6 months late still counts |
| Leads — new / contacted | Last **7 days** |
| Leads — **uncontacted** | Unbounded — an uncontacted lead from last month still counts |
| Meetings tile + Agenda rail | Forward **7 days** (despite reading like "today") |
| **Open deals by pipeline** | Unbounded — every currently-open deal, any age |
| Pipeline **idle** flag | Separate 7-day "no activity" threshold (coincidentally the same number as the window, but a distinct concept) |
| Commission — earned / previous | **Calendar month** (this month / last month), not rolling |
| Commission — **pending** | Unbounded — all-time, no date filter |

## Key files

- Controller: `app/Http/Controllers/DashboardV2Controller.php` (`personalDashboard()`)
- Queries: `app/Services/Dashboard/DashboardMetricsService.php` (`personalQueue`, `personalStats`, `commissionSummary`, `upcomingMeetings`, `openDealsByPipeline`)
- Frontend: `resources/js/Pages/Dashboard/V2/PersonalDashboard.tsx` + `resources/js/Pages/Dashboard/V2/personal/*`
