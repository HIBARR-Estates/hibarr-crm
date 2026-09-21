# Agent guidance (HIBARR CRM)

This file supplements [CLAUDE.md](./CLAUDE.md) with rules agents should follow consistently.

## Translations

The frontend uses two complementary mechanisms:

### Static / fixed UI copy → lang files + `t()`

- Add strings to `resources/lang/{eng,de,tr,ru}/*.php` (nested keys become dot paths, e.g. `pages.dashboard.personal.queue.overdue` → `t("pages.dashboard.personal.queue.overdue")`).
- In React, use `useTranslation()` and `t("pages....")`.
- Prefer this for labels, buttons, panel titles, empty states, and any copy that is known at build time.
- When a shared component would otherwise run `td()` on text you already resolved with `t()`, pass **`localize={false}`** (e.g. `DashboardPanel`, `StatTile`, `MultiStatTile`, `SegmentedControl`).

### Dynamic / server- or user-generated English → `td()`

- Use `useDynamicTranslation()` / `td(text, { source: "en" })` for arbitrary English from the server, config, or user input (pipeline names, event type names, meeting platform labels, ad-hoc toasts, etc.).
- Do not add lang-file keys for one-off or unbounded vocabulary.

### Cache busting

- After adding or changing lang-file keys consumed by the Vite app, bump **`I18N_DICT_VERSION`** in `resources/js/lib/i18n.ts` so clients reload the dictionary.

### Do not double-translate

If the caller used `t()`, downstream components must receive final strings and `localize={false}` where applicable. Mixing `t()` and automatic `td()` on the same string produces wrong or duplicated translations.
