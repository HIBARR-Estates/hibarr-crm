# CRM Email — product brief

**Document ID:** CRM-COM-EMAIL-BRIEF  
**PRD:** CRM-COM-EMAIL v0.2  
**Flag:** `crm.email`  
**Transport for first build:** Mailtrap sandbox (two inboxes). Zoho Mail is the production adapter after CTO setup.

## Primary deliverable

A **new Email module** (from scratch). Selected agents connect **their own mailbox**, then:

1. Connect / stop / reconnect that mailbox in CRM.
2. On an authorized lead or deal: compose, reply, attach files, include a CRM signature, and see truthful send states (not fake Delivered).
3. See Inbox + Sent **from activation forward** on that record when matching is reliable (including mail sent outside CRM once the provider adapter supports it).
4. Handle unmatched mail in a **private review queue** (create lead, attach, dismiss, later handoff/escalate).
5. Optionally create a task, meeting, or note **linked to that exact message**. Email alone does not change stage, convert, or complete tasks.
6. Managers see a **work report** of stuck routing, open follow-ups, unresolved handoffs, and sync/send faults — not a reply-score.

If the feature flag is off, none of this exists in UI or HTTP APIs.

## Source of truth

The **agent mailbox copy** is the system of record for “did this connected user receive or send this?”  
Lead/deal Timeline and drawers are **projections** of linked conversations. Unlink removes the projection; the mailbox copy remains.

Zoho/Mailtrap is an upstream replica, not the CRM SOT.

## In scope (pilot)

- Individual agent identities (not company/shared mailboxes)
- New mail and replies; incremental Inbox/Sent from activation (no bulk backfill)
- Threading via RFC reply identifiers only
- Signature, attachments, conversation + exchanged-attachments views in existing lead/deal redesign UI
- Private review of unlinked mail
- Two connected agents: two mailbox copies; one record event if linked to the same record
- Feature-flagged; Mailtrap adapter first; Fake adapter for tests; Zoho adapter later behind the same port

## Out of scope (this programme)

- Shared/company mailboxes, round robin, campaigns, AI writing
- Production partner-provider connectors
- Bulk history import
- Automatic task completion or lead stage changes
- General employee inbox
- Bcc composer (document provider Bcc only)
- Reuse of `communication_activities`, company SMTP “send to customer”, ticket IMAP, Zoho Calendar/SSO tokens as mail

## Coexistence

Until product sunsets it, legacy SMTP communication-activity email may still exist. Pilot Email is a **separate** history. Do not merge the two stores.

## Milestones

| # | Meaning |
|---|---------|
| M1 | Flag + Fake/Mailtrap port: connect, send, persist mailbox copies |
| M2 | Threading, unique contact match, private review, two-copy / one record event |
| M3 | Lead (then deal) Quick action, composer, drawer, Timeline group; ACL on every read path |
| M4 | Handoff, unread indicators, manager report, mailbox stop |
| M5 | Zoho adapter + provider spike (CTO). Policy: retention, malware, successor access |

M5 policy items stay **blocked** until signed. Engineering may build M1–M4 on test mailboxes only.

## Success (pilot)

Named agents can complete compose, reply, and attachment tasks **inside CRM** without copy-paste. Missed/duplicate messages and time-to-find-a-reply are measured against a baseline. A mailbox-level stop halts new send and sync without deleting authorized history.
