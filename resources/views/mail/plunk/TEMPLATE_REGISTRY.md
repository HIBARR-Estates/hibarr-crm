# Plunk email template registry

Copy HTML from the `.plunk.html` files into Plunk dashboards, then set the template ID in `config/email.php` → `plunk_template_ids` (property IDs are hardcoded there — no `.env`).

## Templates added / updated today

| Plunk template file | Config key (`config/email.php`) | Current ID | SMTP fallback blade |
|---|---|---|---|
| `plunk/entity-activity.plunk.html` | `entity_activity` | `381c73fb-3938-4b32-8255-d3fb9d68d501` | `mail/deal/activity`, `mail/lead/activity`, `mail/property/activity` |
| `plunk/property-request.plunk.html` | `property_request` | `4b95a65c-9c0e-419a-b4c2-699370eaa829` | `mail/property/request` |
| `plunk/property-request-reviewed.plunk.html` | `property_request_reviewed` | `381c73fb-3938-4b32-8255-d3fb9d68d501` | `mail/property/request` |
| `plunk/expose-ready.plunk.html` | `expose_ready` | `588657fa-4242-4b4b-b8b9-6279b93cd97e` | `mail/property/activity` |

Subject lines: matching `.plunk.subject` files in the same folder.

---

## Shared template: `entity-activity` (one Plunk template, many notifications)

Use **one** Plunk template for all rows below. Differentiate with the `badgeLabel` and `introText` variables.

### Deal (`badgeLabel`: `Deal Activity`)

| Notification class | Email setting slug | Events |
|---|---|---|
| `DealActivityNotification` | `deal-activity-notification` | Notes, stage/pipeline, tasks, files, watchers, agents |
| `DealActivityNotification` | `deal-package-notification` | Package assigned / removed |
| `DealActivityNotification` | `deal-property-notification` | Property linked / unlinked |
| `DealActivityNotification` | `deal-activity-notification` | Meeting scheduled / updated / cancelled |

Already wired to Plunk (update existing template: rename `dealUrl` → `entityUrl`).

### Lead (`badgeLabel`: `Lead Activity`)

| Notification class | Email setting slug | Events |
|---|---|---|
| `LeadActivityNotification` | `lead-notification` | Note added / updated / deleted |
| `LeadActivityNotification` | `lead-notification` | File uploaded / updated / deleted |

### Property (`badgeLabel`: `Property Activity`)

| Notification class | Email setting slug | Events |
|---|---|---|
| `PropertyActivityNotification` | `property-activity-notification` | Created, published, unpublished, status/price change, agent assigned, document uploaded, archived |

### Task (`badgeLabel`: `Task Update`)

| Notification class | Email setting slug | Events |
|---|---|---|
| `TaskDeleted` | `task-deleted` | Task deleted |
| `TaskRejected` | `task-rejected` | Task rejected from review |
| `TaskOverdue` | `task-overdue` | Task overdue (cron) |
| `TaskPriorityUpdated` | `task-priority-updated` | Priority changed |
| `SubTaskCreated` | `sub-task-created` | Sub-task created |

---

## Dedicated template: `expose-ready`

| Notification class | Email setting slug | Events |
|---|---|---|
| `ExposeReadyNotification` | `expose-ready` | PDF exposé generation complete |

Uses `downloadUrl` instead of `entityUrl`.

---

## Shared template: `property-request` (incoming — action required)

Paste **`plunk/property-request.plunk.html`** into Plunk once. Deny links are embedded in `contentHtml` (not a second button).

| Notification class | badgeLabel | Primary CTA |
|---|---|---|
| `AvailabilityRequested` | Availability Request | Approve Request (signed URL) |
| `AvailabilityEscalationReminder` | Availability Reminder | Approve Request (signed URL) |
| `AvailabilityEscalation` | Availability Escalation | View Request |
| `EditAccessRequested` | Edit Access Request | Review Request |
| `PropertyAccessRequest` | Property Access | View Property |
| `PublishRequestSubmitted` | Publish Request | Review Publish Requests |

**Config:** `config('email.plunk_template_ids.property_request')`  
**SMTP fallback:** `mail/property/request.blade.php`

### Variables — `property-request`

| Variable | Description |
|---|---|
| `mailSubject` | Subject without app suffix |
| `preheader` | Inbox preview |
| `badgeLabel` | Header category |
| `notifiableName` | Recipient name |
| `introText` | Opening paragraph |
| `contentHtml` | Property meta + message + optional deny link |
| `actionDescription` | Text above primary button |
| `actionText` | Primary CTA label |
| `entityUrl` | Primary CTA URL |
| `footerNote` | Optional note below button (empty string if unused) |

---

## Shared template: `property-request-reviewed` (outcomes)

Uses the **same layout as `entity-activity`**. Paste `plunk/property-request-reviewed.plunk.html` or reuse your existing entity-activity Plunk template.

| Notification class | badgeLabel | CTA |
|---|---|---|
| `AvailabilityResponse` | Availability Response | View Property (approved only) |
| `EditAccessReviewed` | Edit Access | Edit Property (approved only) |
| `PublishRequestReviewed` | Publish Review | View Property |

**Config:** `config('email.plunk_template_ids.property_request_reviewed')` (same ID as `entity_activity`)

---

## Property workflow (legacy section — now implemented)

See **`property-request`** and **`property-request-reviewed`** sections above.

---

## Other existing Plunk templates (unchanged)

| Template file | Plunk ID / env | Used by |
|---|---|---|
| `deal/deal-activity.plunk.html` | → sync with `plunk/entity-activity` | Legacy copy; same as shared |
| `deal/deal-deleted.plunk.html` | `45171f58-24cf-468e-8a8b-0edaf9023142` | `DealDeleted` |
| `deal/deal-close-date-approaching.plunk.html` | `f1da65e3-4b42-40c5-b5ae-1ba82fe3d94d` | `DealCloseDateApproaching` |
| `deal/deal-reminder.plunk.html` | per-company reminder settings | `ReminderNotification` (deal) |
| `deal/deal-agent-assigned.plunk.html` | `336e4f34-69bf-4a4f-92af-96e318a80548` | `LeadAgentAssigned` |
| `deal-follow-up/deal-follow-up-reminder.plunk.html` | per-company / fallback | Meetings (`AutoFollowUpReminder`, `ReminderNotification`) |
| `lead/lead-deleted.plunk.html` | `727f5903-5332-4ec3-992d-ad289264a10a` | `LeadDeleted` |
| `lead/lead-follow-up-overdue.plunk.html` | `LEAD_FOLLOW_UP_OVERDUE_PLUNK_TEMPLATE_ID` | `LeadFollowUpOverdue` |
| `lead/new-lead-created.plunk.html` | `d64189c5-07db-44be-8a6e-f16df5b2a9c0` | `NewLeadCreated` |
| `lead/lead-owner-assigned.plunk.html` | `cde4d601-d358-45e5-9782-1e79d5c4f9f7` | `LeadOwnerAssigned` |
| `lead/leads-imported.plunk.html` | `c5b022f4-988b-49d1-8a28-bfcdf26cb0bd` | `LeadImported` |
| `task/task-reminder.plunk.html` | per-company reminder settings | `ReminderNotification` (task) |
| `note/note-reminder.plunk.html` | per-company reminder settings | `ReminderNotification` (note) |
| `property/property-reminder.plunk.html` | per-company reminder settings | `ReminderNotification` (property) |
| `developer-project/*.plunk.html` | per-company reminder settings | `ReminderNotification` |
| `lead-flight-itinerary/*.plunk.html` | per-company reminder settings | `ReminderNotification` |

---

## Variable reference — `entity-activity`

| Variable | Description |
|---|---|
| `mailSubject` | Subject without app suffix |
| `appName` | App name for subject/footer |
| `preheader` | Inbox preview |
| `badgeLabel` | Header category label |
| `notifiableName` | Recipient name |
| `introText` | One-line activity summary |
| `contentHtml` | Detail block (HTML) |
| `actionDescription` | Text above button |
| `actionText` | Button label |
| `entityUrl` | Deep link (deal / lead / property / task) |
| `currentYear` | Footer year |

## Variable reference — `expose-ready`

Same as above except `downloadUrl` replaces `entityUrl`.

---

## Setup checklist

1. Paste `plunk/entity-activity.plunk.html` into Plunk (or update existing deal-activity template: `dealUrl` → `entityUrl`).
2. Paste `plunk/property-request.plunk.html` into Plunk (new template for workflow requests).
3. Paste `plunk/expose-ready.plunk.html` into Plunk (new template).
4. Set subjects from `.plunk.subject` files.
5. IDs live in **`config/email.php`** → `plunk_template_ids` (already set).
6. Run mail through UNS routing (`crm.notification-service-routing` flag) to use Plunk headers.
