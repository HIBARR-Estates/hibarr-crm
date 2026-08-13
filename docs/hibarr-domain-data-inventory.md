# HIBARR CRM — Domain Data Inventory

Rough map of what the product actually stores for leads, deals, meetings, tasks, MLM, commissions, and agents. Derived from Eloquent models and migrations — not a full schema dump.

---

## How the domains connect

```text
User ── LeadAgent (parent_agent_id + agent_hierarchy)
              │
              ├─► Deals (agent_id) ──► MlmCommission, payments, notes, files
              │         │
              │         └─► DealFollowUp / meetings / summaries
              │
              └─► metrics / levels / cycles

Lead (contact) ── many Deals
     ├─ lifecycle, marketing, qualifications, contact files
     └─ referred_by_agent_id (partner) vs agent_id / lead_owner (worker)

Task ◄── taskables ──► Lead or Deal (and classic project tasks)
```

**Product notes**

1. **Lead vs Deal:** contact/person data lives on `leads`; opportunity/pipeline/money/outcome on `deals`. Some deal satellites still use `lead_*` table names (`lead_follow_up`, `lead_pipelines`).
2. **Meetings ≈ follow-ups** (`DealFollowUp`), not a standalone Meeting entity.
3. **Two commission stacks:** prefer `mlm_commissions` + agents for current Hibarr MLM; `commissions` + `employee_details` is the older employee path.
4. **Agent is an assignment edge to User**, with hierarchy and rates; profile data is on User/Employee.
5. **Extensibility:** custom fields on Lead/Deal/Task; Hibarr-specific deal docs in `hibarr_deal_custom_fields`.

---

## 1. Leads

**Main model:** `Lead` → `leads`  
Company-scoped contact (person); soft-deletes + merge support.

### Core fields

| Area | Fields |
|------|--------|
| Identity / contact | `client_name`, `client_email`, `salutation`, `image`, `mobile`, `cell`, `office`, `client_whatsapp`, `client_telegram`, `client_instagram`, `telegram_chat_id` |
| Address / firm | `company_name`, `website`, `address`, `city`, `state`, `country`, `postal_code` |
| Demographics | `gender`, `date_of_birth`, `age`, `age_range`, `languages` (JSON), `primary_language`, `nationality`, `occupation` |
| Classification | `type`, `temperature` (cold/warm/hot), `source_id`, `category_id` (+ multi via pivot), legacy `status_id`, `lead_lifecycle_status_id` |
| Ownership | `lead_owner` (User), `agent_id` (working LeadAgent), `referred_by_agent_id` (partner introducer), `client_id` (User if converted) |
| Value / board | `value`, `currency_id`, `column_priority`, `next_follow_up` |
| Lifecycle / ops | `assigned_at`, `first_contacted_at`, `note`, `hash`, `remind_at`, `reminders` |
| Merge | `deleted_at`, `merged_into_lead_id` |
| Meta | `company_id`, `added_by`, `last_updated_by`, custom fields |

### Satellite data

| Model / table | What it stores |
|---------------|----------------|
| `LeadMarketing` / `lead_marketing` | UTMs, Facebook/ad IDs, UA/IP, webinar/group/ebook flags, `contact_score` |
| `LeadNote` (+ members) | Notes (`title`, `details`, reminders, visibility) |
| `LeadContactFile` | File attachments on the contact |
| `LeadQualification` | Scripted qualification run (status, outcomes, branches, language, times) |
| `LeadQualificationAnswer` | Per-segment answers |
| `LeadQualificationActionRun` | Side-effects of qualification outcomes |
| `LeadLifecycleStatus` | Company-defined statuses (new → converted/lost, etc.) |
| `LeadSource` / `LeadCategory` / `LeadStatus` | Lookup tables |
| `LeadFlightItinerary` | Travel planning (also attachable to deals) |
| `LeadSavedView`, `LeadSetting`, forms | Saved filters, SLA, public form config |
| `CommunicationActivity` | Channel messages; can link `lead_id` and/or `deal_id` |

---

## 2. Deals

**Main model:** `Deal` → `deals`  
Opportunity under a lead; pipeline-driven.

### Core fields

| Area | Fields |
|------|--------|
| Core | `name`, `lead_id` (contact), `company_id`, `hash`, `note` |
| Pipeline | `lead_pipeline_id`, `pipeline_stage_id`, `column_priority`, `stage_entered_at` |
| Assignment | `agent_id`, `category_id`, source (via relation), `added_by`, `last_updated_by` |
| Money | `value`, `manual_value`, `calculated_value`, `value_source`, `currency_id`, `exchange_rate`, `max_commission_percentage` |
| Outcome / lock | `outcome_status` (won/lost), `won_at`, `close_date`, `is_locked`, `locked_at` |
| Analysis | `analysis_status`, `analysis_completed_at`, `analysis_completed_by` |
| Ops | `next_follow_up`, `next_follow_up_date`, `remind_at`, `reminders`, `bitrix_id`, `client_id` |

### Satellite data

| Model / table | What it stores |
|---------------|----------------|
| `DealNote` | Title/details + reminders |
| `DealFile` | Filename/hash/external storage |
| `DealHistory` | Event stream (stage moves, files, tasks, notes, agent, etc.) |
| `DealFollowUp` → `lead_follow_up` | Meetings / follow-ups (see Meetings) |
| `HibarrDealFields` | Interest/motivation/budget/docs: strategy meeting, downpayment, deposit, reservation, sales contract |
| `DealOfferApplication` | Applied discounts per product/source |
| `Payment` | Amounts, gateway, deal/invoice links |
| Deal automation (+ conditions/actions/logs) | Pipeline rules and run logs |
| Custom fields | Extensible deal fields |
| Watchers / participants | View vs edit team access |

Also: packages (M2M `deal_package`), products, MLM commissions, morph tasks, communication activities, flight itineraries.

---

## 3. Meetings

Meetings are **not** a single “Meeting” entity. Primary product data lives in follow-ups + types + summaries.

### Primary: `DealFollowUp` → `lead_follow_up`

Linked to **deal and/or lead**.

**Key fields:** `deal_id`, `lead_id`, `meeting_type_id`, legacy `meeting_type` string, `location`, `meeting_link`, `remark`, `next_follow_up_date`, `duration` (minutes), `participants` (JSON user IDs), `status`, reminder fields (`send_reminder`, `remind_time`, `remind_type`, `reminders`), calendar IDs (`event_id`, `meeting_id`), Zoho sync fields, `summary_id`, `added_by`, `last_updated_by`.

### Types & summaries

- **`MeetingType`** → `meeting_types`: name, description, color, active, company
- **`MeetingSummary`** → `meeting_summary`: `summary_object` (JSON), type, deal; linked from follow-ups

### Adjacent

- General calendar **`Event`** (+ attendees, files)
- `UserReminderPreference` for per-user reminder defaults

---

## 4. Tasks

**Main model:** `Task` → `tasks`  
Worksuite-style tasks, extended for CRM via polymorphic attach.

### Core fields

`heading`, `description`, `due_date`, `start_date`, `completed_on`, `priority` (low/medium/high), `status`, `board_column_id`, `column_priority`, `project_id`, `task_category_id`, `milestone_id`, creators/updaters, `is_private`, `billable`, estimates, recurrence, dependencies, `hash`, `task_short_code`, `event_id`, reminders, soft deletes, `company_id`, custom fields.

### Relations & satellites

- Assignees via `task_users`
- Board column, category, project, milestone
- Subtasks, comments, notes, files, history, labels, time logs
- **CRM attach:** `Taskable` → `taskables` (`task_id`, `taskable_type`, `taskable_id`) — Lead or Deal

---

## 5. MLM

Network program centered on **`LeadAgent`**, not raw Users.

### Config

| Model | What it stores |
|-------|----------------|
| `MlmSetting` | Max commission %, auto-evaluate ancestors, reverse flag, auto-generate cycles, default duration, overflow multiplier |
| `MlmLevel` | Name, slug, rank, commission %, direct/override rates, hidden flag |
| `MlmLevelCriterion` | Metric (`nsa`/`nsd`/`vsa`/`vsd` / combos), operator, threshold, logic group |

### Cycles

| Model | What it stores |
|-------|----------------|
| `MlmCycle` | Number/name, start/end, status, overflow multiplier, max commission snapshot |
| Cycle level / criteria snapshots | Frozen rates and criteria for a cycle |

### Hierarchy & performance

| Model | What it stores |
|-------|----------------|
| `AgentHierarchy` | Closure table: ancestor, descendant, depth |
| `AgentMetric` | All-time NSA / NSD / VSA / VSD |
| `AgentCycleEnrollment` | Agent↔cycle window, status, overflow dates, level achieved |
| `AgentCycleMetric` | Per-enrollment metrics |
| `AgentLevelHistory` | Level changes: when, by whom, system vs manual, optional trigger deal / cycle |

Won deals (`outcome_status`, `won_at`, locks, max commission %) feed metrics and commission attribution.

### Legacy parallel

`employee_details.referral_id` / `level` — separate from agent hierarchy; pairs with legacy `commissions`.

---

## 6. Commissions

Two systems coexist.

### A. Modern deal/agent path (primary)

**`MlmCommission`** → `mlm_commissions`

| Field | Meaning |
|-------|---------|
| `deal_id`, `company_id` | Earning deal |
| `agent_id` | Receiver |
| `source_agent_id` | Agent who closed the deal |
| `level_id`, cycle snapshot | Level context |
| `percentage`, `amount` | Computed pay |
| `type` | `agent` \| `upline` \| `system` |
| `status` | `pending` \| `paid` \| `reverted` |
| `paid_at`, `reverted_at`, `reverted_reason` | Lifecycle |

### B. Legacy employee path

**`Commission`** → `commissions`: `employee_id`, `event_type`, `source_event_id`, `amount`, `level`, `rule_version`, status (pending → approved → paid / cancelled). No deal FK.

### Rate inputs

- Per-agent: `custom_direct_rate`, `custom_override_rate` on `lead_agents`
- Audit: `AgentCommissionRateAuditLog`
- Level defaults on `mlm_levels` / cycle snapshots
- Deal cap: `max_commission_percentage`

---

## 7. Agents

**Main model:** `LeadAgent` → `lead_agents`  
Thin company-scoped “agent seat” over a **User**.

| Field | Role |
|-------|------|
| `user_id` | Backing user |
| `company_id` | Tenant |
| `status` | enabled / disabled |
| `lead_category_id` | Optional category scope |
| `parent_agent_id` | Direct upline |
| `custom_direct_rate`, `custom_override_rate` | Rate overrides |
| `added_by`, `last_updated_by` | Audit |

### Relations & reporting

- Deals via `agent_id`
- Tree: parent/children + hierarchy closure links
- Metrics, level history, cycle enrollments/metrics
- MLM commissions (as payee or as source)
- `AgentReportSummary` — saved report narratives and filters

### Person profile

- **`User`** — auth, name, image, etc.
- Often **`EmployeeDetails`** — HR fields + legacy referral/level
- Not duplicated on `lead_agents` beyond rates, parent, category, status

Lead touchpoints: working `agent_id`, partner `referred_by_agent_id`. Deal watchers/participants are Users (not always LeadAgents).
