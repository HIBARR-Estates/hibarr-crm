---
name: i18n-refactor
description: "Refactor React/Inertia TSX page files to use the useTranslation hook for all hardcoded UI strings, and populate translation keys in the four locale pages.php files (eng/de/ru/tr). USE FOR: translating hardcoded strings in TSX page components; adding t() calls for title, breadcrumbs, placeholders, button labels, action menu items; populating pages.php translation keys across all four supported locales. DO NOT USE FOR: backend PHP strings; non-page components (modals, tables, forms); strings that are dynamic/computed at runtime."
argument-hint: "Path(s) to the TSX file(s) to refactor, e.g. resources/js/Pages/Clients/Index.tsx"
---

# i18n Refactor Skill

## Purpose

Scan one or more Inertia page TSX files for hardcoded UI strings and:

1. Replace each string with a `t("pages.<folder>.<key>")` call
2. Add the `useTranslation` import and `const { t } = useTranslation()` hook
3. Populate the **four locale `pages.php` files** with new keys and translations

## Translation Infrastructure

- **Hook**: `useTranslation` from `@/Hooks/useTranslation` → returns `{ t, isRtl }`
- **Key namespace**: `pages.*` (served from `resources/lang/*/pages.php`)
- **Locales**: `eng` (English base), `de` (German), `ru` (Russian), `tr` (Turkish)
- **Fallback**: English is always the base; other locales override via `array_replace_recursive()`
- **Lang file paths**:
    - `resources/lang/eng/pages.php` — English (base, always fully populated)
    - `resources/lang/de/pages.php` — German overrides
    - `resources/lang/ru/pages.php` — Russian overrides
    - `resources/lang/tr/pages.php` — Turkish overrides

## Key Naming Convention

```
pages.<PageFolder>.<descriptor>
```

- `<PageFolder>` = lowercase folder name of the page, e.g. `clients`, `deals`, `developer_projects`
- `<descriptor>` = snake_case description of the string, e.g. `title`, `search_placeholder`
- Nested actions: `pages.<folder>.actions.<action>`, e.g. `pages.clients.actions.add`

### Examples

| Hardcoded string                    | Key                                                  |
| ----------------------------------- | ---------------------------------------------------- |
| `"Clients"` (breadcrumb/title)      | `pages.clients.title`                                |
| `"Search clients..."` (placeholder) | `pages.clients.search_placeholder`                   |
| `"Add Client"` (button)             | `pages.clients.actions.add`                          |
| `"Delete"` (action menu)            | Already exists as `app.delete` — reuse, don't create |

## Reusable Existing Keys (Do NOT recreate in pages.php)

These keys already exist in `app.php` — always prefer reusing them:

| String                  | Existing key                                   |
| ----------------------- | ---------------------------------------------- |
| "View"                  | `app.view`                                     |
| "Edit"                  | `app.edit`                                     |
| "Delete"                | `app.delete`                                   |
| "Import"                | `app.import`                                   |
| "Filters" / "Filter"    | `app.filter`                                   |
| "Refresh"               | `app.common.actions.refresh`                   |
| "Dashboard"             | `app.menu.dashboard`                           |
| "Settings"              | `app.menu.settings`                            |
| "Clients"               | `app.menu.clients`                             |
| "Projects"              | `app.menu.projects`                            |
| "Properties"            | `app.menu.properties`                          |
| "Deals" (single label)  | `app.deal`                                     |
| "Schedule Meeting"      | `app.deals.actions.schedule_meeting`           |
| "Availability Requests" | `app.properties.actions.availability_requests` |
| "Publish Requests"      | `app.properties.actions.publish_requests`      |

## Step-by-Step Procedure

### Step 1 — Read Target File(s)

For each file provided:

- Read the full file to understand the component structure
- Identify all hardcoded strings that appear in **user-visible UI**:
    - `title="..."` on `<PageLayout>`
    - `breadcrumbs={[{ name: "..." }]}` entries
    - `placeholder="..."` on search inputs
    - Button children: `>Add Foo</Button>`, `>Import</Button>`, etc.
    - Action menu item labels: `{ label: "...", ... }` or `{ key: "...", label: "..." }`
    - Modal/drawer titles if they are hardcoded static strings
- **Skip**: Dynamic expressions `{someVar}`, already-translated `{t("...")}`, JSX computed values

### Step 2 — Read ONLY pages.php (Not app.php)

Read **only** `resources/lang/eng/pages.php` to see what keys already exist. Do NOT read `app.php` — it is too large. Check the reusable keys table above instead.

### Step 3 — Plan Keys

For each string found:

1. Check if a reusable key from the table above covers it → use that key
2. Otherwise, assign a new `pages.<folder>.<key>` key
3. Group new keys by page folder

### Step 4 — Apply TSX Changes

For the target file(s), apply these changes using `multi_replace_string_in_file`:

**a) Add import** (after the last existing import from `@/` or adjacent imports):

```tsx
import useTranslation from "@/Hooks/useTranslation";
```

**b) Add hook** (first line inside the main component function body, before any other hooks):

```tsx
const { t } = useTranslation();
```

**c) Replace each string** with its `t("pages.folder.key")` call:

- Attribute strings: `title="Foo"` → `title={t("pages.folder.title")}`
- JSX children: `>Foo</Button>` → `>{t("pages.folder.actions.foo")}</Button>`
- Template literals that mix static+dynamic remain template literals: ``title={`${t("pages.folder.title")}: ${dynamic}`}``

**IMPORTANT**: If the component already has `useTranslation` imported/used, only add the NEW `t()` calls — skip the import and hook steps.

### Step 5 — Populate pages.php Files

Write ALL four locale files in a single `multi_replace_string_in_file` call.

For `eng/pages.php` — add the full English key/value array.
For `de/pages.php`, `ru/pages.php`, `tr/pages.php` — add translations of only the new keys.

**Translation quality rules:**

- German: formal register, use established CRM terminology
- Russian: use standard business Russian (Вы-form not required in UI labels)
- Turkish: standard business Turkish, no slang
- For proper nouns and abbreviations (CRM, MLM, Kanban), keep them as-is in all locales

**Insertion pattern** (append new folder block inside the `return [` array):

```php
// In eng/pages.php — add after existing entries:
'clients' => [
    'title'              => 'Clients',
    'search_placeholder' => 'Search clients by name, email...',
    'actions' => [
        'add'    => 'Add Client',
        'invite' => 'Invite Client',
    ],
],
```

### Step 6 — Validate

After all edits:

- Run `get_errors` on each modified TSX file
- Confirm no TypeScript errors were introduced
- Spot-check that each `t()` call references a key that exists in `eng/pages.php`

## Edge Cases

**Sub-components in the same file**: If a file defines multiple React components and a sub-component uses hardcoded strings, it also needs its own `const { t } = useTranslation()` call inside its function body.

**pageTitle prop**: Many pages receive a `pageTitle` PHP-computed prop and pass it directly to `<PageLayout title={pageTitle}>`. Do NOT replace `{pageTitle}` with a `t()` call — the server already localizes it. Only replace **static string literals**.

**Conditional strings**: `title={isEdit ? "Edit Client" : "Add Client"}` → `title={isEdit ? t("pages.clients.actions.edit") : t("pages.clients.actions.add")}`

**Import path variations**: Some files use `"../../Components/PageLayout"` (relative), some use `"@/Components/PageLayout"` (alias). Match the existing import style in the file for useTranslation: always use `"@/Hooks/useTranslation"`.

## File Reference

| File                                            | Purpose                                      |
| ----------------------------------------------- | -------------------------------------------- |
| `resources/lang/eng/pages.php`                  | English base translations (read + write)     |
| `resources/lang/de/pages.php`                   | German translations (write only)             |
| `resources/lang/ru/pages.php`                   | Russian translations (write only)            |
| `resources/lang/tr/pages.php`                   | Turkish translations (write only)            |
| `app/Http/Middleware/HandleInertiaRequests.php` | Loads `pages.php` files — already configured |
| `resources/js/Hooks/useTranslation.ts`          | Translation hook                             |
