# CRM Email — architecture

Greenfield module. CRM talks to providers only through `MailTransport`. UI and matching never use Mailtrap or Zoho IDs as primary keys.

## Hard rules

1. Feature flag `crm.email` off → no routes, jobs, or UI. Also require a **pilot allowlist** (user and/or company) so a global flag cannot open Email for everyone.
2. **Do not** use `CommunicationActivity`, `CustomerCommunicationEmail`, company SMTP, `FetchTicketEmails`, or `config/zoho.php` calendar tokens.
3. **Mailbox copy is SOT.** Record Timeline/search/drawers are projections of **linked** conversations.
4. Persist **CRM UUIDs**. Provider ids (`mailtrap_message_id`, IMAP UID, Zoho id) and RFC `Message-ID` are metadata.
5. Never label provider acceptance as Delivered.
6. Subject-similar is not a thread match. Use `Message-ID` / `In-Reply-To` / `References`.
7. Dismiss/unlink does not delete mail at the provider.
8. Logs must not dump full bodies or tokens.
9. Redesign UI only (`Components/Redesign`, lead/deal Quick actions). Deferred loads; mutations patch local state; `t()` / `td()` as in AGENTS.md.

## Port (`App\Email\Contracts\MailTransport`)

Stable operations (names may be refined in E-03, not the idea):

| Method | Meaning |
|--------|---------|
| `health(Connection)` | Reachable / needs reconnect / quota backoff |
| `send(Connection, Draft): SendResult` | Accepted / rejected / unknown / throttled + provider submission id |
| `fetchSince(Connection, Checkpoint, folders): FetchPage` | Normalized messages + new checkpoint |
| `getMessage(Connection, providerId)` | Full payload when list was thin |
| `getAttachment(Connection, providerId, partId)` | Bytes for scan/store |

Adapters implement this only: `FakeMailAdapter` (tests), `MailtrapAdapter` (dev/staging), `ZohoMailAdapter` (later). Hybrid Zoho API+IMAP is still **one** adapter internally if needed.

Controllers/jobs depend on the port + a factory keyed by `email_connections.provider`.

### DTOs (adapter edge)

Normalize once: RFC Message-ID, In-Reply-To, References, From/To/Cc/Reply-To, sent-at (original), subject, text, html (unsanitized raw stored separately), attachments list, folder/label, direction (inbound/outbound), provider ids.

Send-state machine lives **in CRM**, not in the adapter.

## Source-of-truth layers

| Layer | Role |
|-------|------|
| Provider (Mailtrap/Zoho) | Upstream. CRM recovers toward it via checkpoints. |
| `email_mailbox_copies` | SOT for ownership, unread-on-mailbox, review vs linked, “I still have this after unlink.” |
| `email_messages` | Canonical body/headers/files per company + RFC Message-ID (when present). |
| `email_conversations` + links | Projection onto lead and/or deal. |

**Two agents, one mail:** two copies, one canonical message (same RFC Message-ID), one Timeline event if both are linked to the same record. Independent unread and reply.

Mailtrap cannot fan-out one SMTP send to two inboxes. Tests **inject** the same Message-ID into two connections (two sandboxes). See [dependencies.md](./dependencies.md).

## Proposed schema (E-05–E-08; names indicative)

All tables: `company_id`, timestamps. Soft deletes only where retention/audit requires a tombstone.

**`email_connections`**  
`user_id`, `provider` (`fake` \| `mailtrap` \| `zoho`), `identity_email`, `from_email`, `reply_to_email`, encrypted `credentials` (JSON), `status` (`active` \| `stopped` \| `needs_reconnect` \| `error`), `sync_stopped_at`, Inbox/Sent checkpoints (JSON), `last_sync_at`, `last_error_code` (no raw provider dump).

**`email_pilot_allowlist`**  
`user_id` (and/or `company_id`). Connection create requires row + flag.

**`email_messages`**  
`rfc_message_id` (nullable unique per company when present), `thread_keys` (JSON), parsed addresses, `subject`, `sent_at`, `text_body`, `html_raw`, `html_safe` (after sanitize), `has_attachments`.

**`email_mailbox_copies`**  
`connection_id`, `message_id`, `provider_message_id`, `folder`, `direction`, `review_status` (`none` \| `unlinked` \| `dismissed` \| `handed_off` \| …), unique (`connection_id`, `provider_message_id`).

**`email_conversations`**  
Stable thread id derived from reply graph, not subject.

**`email_conversation_participants`** (optional)  
Addresses on the thread.

**`email_record_links`**  
`conversation_id`, `linkable_type` (`Lead` \| `Deal`), `linkable_id`, `linked_by`, `linked_at`. One conversation may link to a lead and, after conversion, be **visible** on the deal without duplicating messages (deal `lead_id`).

**`email_link_audits`**  
link, unlink, dismiss, handoff, escalate, accept/reject.

**`email_send_attempts`**  
`connection_id`, `draft_payload` (or FK to draft), `status` (`sending` \| `sent` \| `failed` \| `checking` \| `waiting_quota`), `provider_submission_id`. Retry reconciles the same attempt; do not insert a second message blindly.

**`email_send_recipients`**  
Per-address: accepted / delayed / bounced / blocked_until_review.

**`email_files`**  
FK to message; storage key on existing file gateway **prefix** `email-attachments/` (not lead/deal Files). `scan_status`, filename, size, mime.

**`email_signatures`**  
Per connection/identity, CRM-authored HTML/text.

**`email_user_reads`**  
`(user_id, mailbox_copy_id)` or `(user_id, message_id)` — opening marks **this user** read, not colleagues and not the provider.

**`email_handoffs`** (E-31)  
From copy/conversation, to user, state pending/accepted/rejected; does not change `lead_owner`.

**`email_bounce_holds`** (E-40, after reliable DSN)  
Address + reason + resolved_by.

Exact columns land in migrations; this list is the domain.

## Matching order (E-13–E-15)

1. Join conversation if In-Reply-To/References match a known CRM message.
2. Else if **exactly one** authorized contact email on a record the mailbox owner may see → conversation on that record (new if needed).
3. Else → private review (or manager reconciliation if a record exists but the owner must not see it).

Alternate/spouse/assistant addresses: associate to a lead **without** treating them as the customer (contact-method role; E-14 follow-up if product confirms).

Ambiguous match: never pick a winner.

## Authorization

Every body, file, search snippet, export, notification preview, and signed URL goes through `App\Email\Authorization\EmailAccess` (E-20). See [access-matrix.md](./access-matrix.md). Fail closed.

Do not use `view_lead` alone: partner-as-Lead-Owner must not imply communications access.

## Jobs and queues

Dedicated queues, e.g. `email-sync` and `email-send`, so default workers do not starve mail.

- Sync: per connection, checkpointed, idempotent on provider id + Message-ID.
- Send: persist attempt first; map adapter result; quota → `waiting` without paging the agent.
- Sanitize/scan attachments asynchronously; message can exist with file `unavailable`.

p95 “visible in two minutes” is **measured**, not an SLO, until the Zoho spike.

## HTTP / UI shape

Prefix routes (flag middleware): `/email/...` JSON for composer, review, files, connection. Inertia pages for review queue and manager report.

Lead redesign: Quick action Email (today: Log / Note / Meeting only). Deal: equivalent. Drawer: Conversation + Exchanged attachments. Timeline: **one compact group per conversation**, not a duplicate generic `email_sent` activity row.

Mutations: axios + local/workspace state, not Inertia reload.

## Search

Record-scoped: participants, subject, body, attachment filename — only if the user passes EmailAccess for that message. Private review search: `connection.user_id = auth`. No Universal Search index of bodies in M1–M3 unless ACL is proven.

## What we explicitly do not build here

- Provider-specific UI
- Using Mailtrap plus-addressing as multi-agent routing
- Writing email files into `LeadFile` / deal files
- Auto-creating deals/leads except the **explicit** review action “create lead” (then existing duplicate-lead **service call** only — not the comms resolver)
