# CRM Email module — working docs

**PRD:** CRM-COM-EMAIL v0.2 (source of requirements). These files are **how we build**, not a rewrite of R01–R15.

**Branch:** `feat/email-integration-module`  
**Flag:** `crm.email` (off by default; plus a CRM allowlist for pilot mailboxes)  
**Status:** Planning docs only. Implementation starts at task **E-01** when explicitly requested.

| Doc | Use |
|-----|-----|
| [brief.md](./brief.md) | Product deliverable, in/out of scope, milestones |
| [architecture.md](./architecture.md) | Port/adapters, SOT, tables, queues, hard rules |
| [dependencies.md](./dependencies.md) | Mailtrap now, Zoho later, secrets, files, flag |
| [access-matrix.md](./access-matrix.md) | Who may see what; TBD cells fail closed |
| [checklist.md](./checklist.md) | Numbered tasks (`Implement task E-XX`) |

**Do not** implement email via `communication_activities`, company SMTP, ticket IMAP, or Zoho Calendar tokens.
