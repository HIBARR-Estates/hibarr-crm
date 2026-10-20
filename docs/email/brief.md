# CRM Email — product brief

**Document ID:** CRM-COM-EMAIL-BRIEF  
**PRD:** CRM-COM-EMAIL v0.2  
**Flag:** `crm.email`  
**Transport for first build:** Mailtrap sandbox (two inboxes). Zoho Mail is the production adapter after CTO setup.

## Primary deliverable

A **new Email module** (from scratch). Email is channel 1 of a communication shell; later channels (calls, WhatsApp, and others) are not built here. Selected agents connect **their own mailbox**, then:

1. Connect / stop / reconnect that mailbox from **account settings** (`/account/settings/mailbox`) and the user menu, beside Preferences.
2. On an authorized lead or deal, open a **Communication modal**: the thread history with that lead in the record’s context, then compose or reply. To and Cc are the lead’s known addresses only. Send states stay truthful (not fake Delivered).
3. See an **inbox of mail the CRM has already synced** for that connection, grouped into conversations. Date presets (last 7, 14, 30, 90 days, or a custom from/to) filter those stored records by message date. They do not call the provider and do not backfill.
4. Handle unmatched mail as a **Needs review** state inside that inbox (create lead, attach, dismiss, handoff/escalate).
5. Optionally create a task, meeting, or note **linked to that exact message**. Email alone does not change stage, convert, or complete tasks.
6. Managers see a **work report** of stuck routing, open follow-ups, unresolved handoffs, and sync/send faults — not a reply-score.
7. A newly synced inbound copy notifies the mailbox owner through the existing in-app notification poll. The click opens that message in the inbox.

The lead/deal Timeline keeps one compact group per conversation. That group is a pointer into the Communication modal, not the place the agent reads or replies.

If the feature flag is off, none of this exists in UI or HTTP APIs.

## Source of truth

The **provider** (Zoho or Mailtrap) is the authority for whether a message exists and what it contains. The CRM does not invent messages and does not become a second mailbox.

**`email_mailbox_copies`** is the synced projection the CRM reads, plus CRM-only facts the provider cannot store: record link, review / dismiss / handoff, and in-app unread. Inbox lists and date filters query that projection. They never call `MailTransport`.

Lead/deal Timeline groups are **pointers** into linked conversations. The Communication modal is the record surface. Unlink removes the projection; the mailbox copy remains.

Sync is incremental from activation. A “last 3 months” preset on a mailbox connected yesterday shows only what has arrived since yesterday.

## In scope (pilot)

- Individual agent identities (not company/shared mailboxes)
- New mail and replies; incremental sync from activation (no bulk backfill)
- Inbox of synced copies, with date presets and a Needs review segment
- Communication modal on lead and deal; known-address To/Cc
- Mailbox settings under account settings and the user menu
- In-app notification on first ingest of an inbound copy
- Threading via RFC reply identifiers only
- Signature, attachments, conversation views in the Communication modal
- Two connected agents: two mailbox copies; one record event if linked to the same record
- Feature-flagged; Mailtrap adapter first; Fake adapter for tests; Zoho adapter later behind the same port

## Out of scope (this programme)

- Shared/company mailboxes, round robin, campaigns, AI writing
- Production partner-provider connectors
- Bulk history import, or a date filter that fetches missing mail from the provider
- Live provider queries to render the inbox
- A generic messages table or a second channel (WhatsApp, Telegram, Instagram, calls)
- Automatic task completion or lead stage changes
- A free-form mail client (arbitrary To/Cc outside the lead’s known addresses)
- Bcc composer (document provider Bcc only)
- Emailing the agent a copy of customer mail
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
| M6 | Communication modal, known recipients, synced-mail inbox, mailbox settings, new-mail notification (E-46–E-51). Zoho spike waits on this surface |

M5 policy items stay **blocked** until signed. E-39–E-41 (Zoho spike, bounce hold, staging cutover) wait until E-48–E-51 have landed, so production mail opens in the Communication modal and the inbox.

## Success (pilot)

Named agents can complete compose, reply, and attachment tasks **inside CRM** without copy-paste. Missed/duplicate messages and time-to-find-a-reply are measured against a baseline. A mailbox-level stop halts new send and sync without deleting authorized history.
