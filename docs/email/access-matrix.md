# CRM Email — access matrix

**Rule:** If a cell is **TBD**, implementation **fails closed** (deny). Do not invent access. Product/Founder/legal sign TBD before E-44 and before real customer mail.

Authorization is **server-side** on body, files, search, exports, notification previews, and direct links (`EmailAccess`, task E-20).

## Actors

| Actor | Meaning |
|-------|---------|
| Mailbox owner | Connected user whose copy received or sent the message |
| Lead Owner | `leads.lead_owner` — CRM assignment; **not** mailbox ownership |
| Deal agent / participant | Deal `agent_id` / participants (full deal access today) |
| Deal watcher | View-only on deal today — **TBD** for email |
| Manager | Module `all` or named manager role — **TBD** for private review vs linked mail |
| Successor | Cover when mailbox owner is absent — **TBD** |
| Partner as Lead Owner | Legacy imports; **must not** imply communications access |
| Unrelated agent | No mailbox copy, no record access |
| Handoff recipient | Named user on an explicit handoff — still needs appropriate access to **accept** |

## Resource classes

- **Mailbox copy** (unlinked or linked)
- **Linked conversation on a lead/deal** (projection)
- **Review queue item**
- **Email file**
- **Search snippet / notification preview**
- **Audit metadata** (may survive unlink under policy)

## Matrix

Legend: **Y** allow · **N** deny · **L** only if conversation is linked **and** actor has record access **and** communications ACL says so · **TBD** deny until signed.

| Actor | Own unlinked copy | Other user’s unlinked copy | Linked body/files on record they can view | Linked, no record access | Notification/search snippet |
|-------|-------------------|----------------------------|-------------------------------------------|--------------------------|------------------------------|
| Mailbox owner | Y | N | Y | Y (own copy only; no other lead data) | Y (own) |
| Lead Owner (agent, not partner) | N unless also mailbox owner | N | L | N | L |
| Partner as Lead Owner | N | N | N | N | N |
| Deal participant | N | N | L (TBD if deal-only vs lead-linked) | N | L |
| Deal watcher | N | N | TBD | N | TBD |
| Manager | TBD (report counts vs open body) | TBD | TBD | TBD | TBD |
| Successor | TBD | TBD | TBD | TBD | TBD |
| Unrelated agent | N | N | N | N | N |
| Handoff recipient (pending) | N (request card only) | N | N | N | N |
| Handoff accepted | Per policy; **not** the sender’s whole mailbox | N | If record access granted separately | N | Per copy they may see |

### Access conflict (PRD)

Mailbox owner sees **their message** plus a minimal “record exists — manager reconciliation” path. **No** other lead/deal fields, files, notes, or timeline.

### Unlink

Remove record Timeline and search **immediately**. Mailbox owner keeps authorized copy + audit metadata. Others lose record projection.

### Reassignment of Lead Owner

Does not mark old messages unread for the new owner. Does not grant mailbox ownership. New owner sees **linked** mail only if communications ACL allows (today: treat as Lead Owner column).

## Retrieval routes to test (E-20)

For each actor: show message, download file, search, Inertia props, signed URL, review show-by-id, timeline expand, notification payload.

IDs in URLs must not leak another user’s copy (`404`/`403`, same message).

## Open decisions (from PRD §6)

Copy into product workshop; do not resolve in code:

1. Successors and managers: who can open private review vs only counts on the work report?
2. Who can accept an escalation?
3. Absence cover without granting a private mailbox?
4. Watchers on deals: email or not?
5. Unlinked review lifetime and legal hold (E-42)

Until signed, only **mailbox owner** reads unlinked bodies; only **mailbox owner + non-partner Lead Owner / deal participant** (if we implement L as above) read linked bodies — **tighten** if legal says Lead Owner should not see mail they did not receive.
