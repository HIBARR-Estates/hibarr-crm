# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Worksuite-based CRM: a Laravel 10 monolith with Inertia.js bridging to React 19 for the modern screens (TypeScript, `resources/js/Pages/**`). Older screens are still plain Blade + jQuery/Bootstrap 4. There is no separate API/SPA split — Inertia controllers return page props directly.

Current focus area: **`resources/js/Pages/Deals/Redesign/`** — the individual Deal page rebuild. The principles below (reuse-first, no full reloads, background-load everything non-critical) are being established here first and are meant to become the default for the rest of the frontend as it's touched.

## Commands

Backend (PHP):
- `php artisan serve` — run the app locally
- `composer install` — install PHP deps (triggers ide-helper generation)
- `php artisan test` or `vendor/bin/phpunit` — run the full suite (`tests/Unit`, `tests/Feature`, sqlite in-memory per `phpunit.xml`)
- `vendor/bin/phpunit --filter TestMethodOrClassName` — run a single test
- `php artisan test tests/Feature/Path/To/FileTest.php` — run a single test file
- `vendor/bin/pint` — fix PHP style (Laravel Pint)
- `vendor/bin/phpstan analyse` — static analysis via Larastan (`phpstan.neon.dist`, level 2, scoped to `app/Models|Console|Actions|Events|Observers|Listeners|View|Http` + `database`)

Frontend (JS/TS) — **two asset pipelines coexist, pick the one matching the layout you're editing**:
- `npm run v-dev` / `npm run v-build` — Vite (modern; `vite.config.mjs`, entry `resources/js/inertia.tsx`). Used by `resources/views/layouts/inertia_vite.blade.php`. Prefer this for new/redesigned pages.
- `npm run dev` / `npm run watch` / `npm run prod` — Laravel Mix (legacy; `webpack.mix.js`). Used by `inertia.blade.php` / `inertia_alt.blade.php`.
- No JS test runner or linter is configured in this repo (no jest/vitest/eslint config present) — don't assume `npm test` exists.

## Architecture

- **Deferred, non-blocking page loads**: Inertia controllers ship a minimal synchronous prop set and wrap everything else in `Inertia::defer(fn () => ...)` (see `app/Http/Controllers/DealController.php:533` `show()`). The frontend matches each deferred key with Inertia's `<Deferred data="..." fallback={<Skeleton/>}>` (see `DealViewRedesign.tsx`). **New data a page/tab needs should be deferred server-side and wrapped in `<Deferred>` client-side, not fetched eagerly or awaited on first paint.**
- **Local-state-as-source-of-truth for mutations**: pages hold their deferred relations in a React context (e.g. `DealWorkspaceContext.tsx`) seeded from Inertia props. Mutations hit a REST-ish endpoint via `axios` (e.g. `deals.gathering.inline_update`) and patch the context state directly from the response — they do **not** trigger an Inertia visit/reload. This is what keeps edits feeling instant. Follow this pattern for new mutations instead of `router.reload()` or a full page visit.
- **Tab/section navigation is client-side, URL-synced state** — not Inertia navigation. See `useDealViewNavigation.ts`: active tab/section live in `useState`, initialized from `?tab=`/`?section=` query params and kept in sync via `history.replaceState` (no network round-trip, no page reload, back/forward + shareable links still work).
- **Two-tier translation** — `useTranslation()` (`t()`) only resolves keys that exist in `resources/lang/*/*.php`; `useDynamicTranslation()` (`td()`) translates arbitrary inline English strings on the fly (async, batched — first render shows source text, re-renders translated). Static config objects (e.g. `config/dealInfoSections.ts`) can't call hooks, so they store English source strings and get wrapped in `td()` at the render site. Toasts/validation strings follow the same rule: keep English as the source-of-truth string in code, translate at the point of display.
- **Custom fields / pipeline categories** are the generic extensibility mechanism for deal data — categories are scoped server-side per pipeline (`DealController@show`) before reaching the page, so don't re-filter them client-side.

## Working in `Deals/Redesign/`

Layout of the area:
- `components/primitives/` — the shared UI vocabulary (buttons, modals, badges, editable fields, pickers, switches). **Check here first** before writing a new button/modal/input variant.
- `components/{header,tabs,workspace,deal-info,timeline}/` — feature composition, built from primitives.
- `hooks/useDeal*.ts` — one hook per mutation/data-shape (`useDealPackages`, `useDealTaskUpdate`, `useDealNoteMutations`, ...). Each wraps an axios call + patches `DealWorkspaceContext` state. New deal mutations should follow this same shape (hook returns action(s) + `saving`/`loading` state; no direct axios calls from components).
- `adapters/` — pure functions with no hook access (e.g. `dateFormat.ts`) for formatting/shaping data outside the render path.
- `config/` — static, hook-free config objects (nav sections, labels) consumed with `td()` at the call site.
- `context/DealWorkspaceContext.tsx` — the one source of truth for `deal`/`notes`/`tasks`/`dealFollowUps`/`files` on this page.

Rules for changes here (apply repo-wide as other pages get touched):
1. **Reuse before creating.** Search `components/primitives/` and existing `hooks/useDeal*.ts` for something close before adding a new component or a new fetch path. Extend an existing primitive/hook rather than forking it, unless the behavior genuinely diverges.
2. **Never block first paint on non-essential data.** New tab/section data goes through `Inertia::defer` + `<Deferred>` with a skeleton fallback, matching the existing tabs in `DealViewRedesign.tsx`.
3. **Mutations update local state, not the page.** Patch `DealWorkspaceContext` (or the relevant local state) from the mutation response instead of reloading/re-visiting via Inertia — that's what makes edits feel instant.
4. **Navigation stays client-side.** Tab/section switches go through `useDealViewNavigation` (URL query sync via `history.replaceState`), never a server round-trip.
5. **Translate at the boundary**: `td()` for ad-hoc/config strings, `t()` only for real lang-file keys — see the translation rule above.
