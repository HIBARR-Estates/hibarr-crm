# CRM migration inventory report

Read-only Artisan command that counts CRM records for migration sizing (ADR-0007). Emits **aggregates only** — never emails, phones, or names.

## Command

```bash
php artisan migration:inventory-report
  {--company=}
  {--format=table}          # table|json|markdown
  {--output=}
  {--connection=}
  {--env-label=}
  {--section=*}             # entities|duplicates|usage (default: all)
```

## Safety

- Implementation uses query-builder `SELECT` / `COUNT` / `GROUP BY` only. No Eloquent model writes, no temp tables, no report rows written to MySQL.
- Prefer a **read replica** and, when possible, a **SELECT-only** database user.
- Paste **counts only** into ADR-0007. Keep full JSON in a private ops channel if needed; do not commit prod reports with hostnames you consider sensitive without review.

## Replica configuration

Set in the environment (see `.env.example`):

| Variable | Role |
|----------|------|
| `DB_REPLICA_HOST` | Replica hostname (when set, command defaults to `mysql_replica`) |
| `DB_REPLICA_PORT` | Falls back to `DB_PORT` |
| `DB_REPLICA_DATABASE` | Falls back to `DB_DATABASE` |
| `DB_REPLICA_USERNAME` | Falls back to `DB_USERNAME` — prefer SELECT-only |
| `DB_REPLICA_PASSWORD` | Falls back to `DB_PASSWORD` |

Connection name: `mysql_replica` in `config/database.php`.

If `DB_REPLICA_HOST` is unset, the command uses the default connection and adds a warning.

## Staging

```bash
php artisan migration:inventory-report \
  --format=json \
  --env-label=staging \
  --output=storage/app/crm-inventory-staging.json
```

## Production (replica)

Run off-peak for the first full scan. Prefer explicit connection:

```bash
php artisan migration:inventory-report \
  --connection=mysql_replica \
  --env-label=prod \
  --format=json \
  --output=./crm-inventory-prod.json
```

Markdown fragment for the ADR draft:

```bash
php artisan migration:inventory-report \
  --connection=mysql_replica \
  --env-label=prod \
  --format=markdown \
  --output=./crm-inventory-prod.md
```

## Report sections

| Section | Contents |
|---------|----------|
| `entities` | Leads, deals, contact methods, tasks, follow-ups/meetings, reminders, notes, files, custom fields, qualifications, partner/MLM tables |
| `duplicates` | Cross-lead email/phone groups via `lead_contact_methods.normalized` (`duplicate_groups`, `extra_rows`) |
| `usage` | Zero-row partner/MLM tables, empty custom-field definitions, contact-method backfill gap |

`report_version` is `1`. Re-run after data changes; compare dates and version when updating ADR counts.

## Out of scope

- OL inventory (separate backend script)
- Cross-system person matching / identity hash export
- Any migrate, transform, or backfill behaviour
