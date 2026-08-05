# Lead View product tour

**Date:** 2026-08-03  
**Scope:** `hibarr-crm` — Lead Detail Redesign (`resources/js/Pages/Leads/Redesign/`)  
**Pattern:** Mirror Deals Redesign tour (`ProductTour` + `crm.deals-product-tour` + `pages.deals.tour`)

## Goal

Ship a first-visit spotlight tour that teaches the new lead page: what each region is for, and **how to get to** qualification, editing, deals, files, and common actions — without blocking work when a region is feature-gated (those steps auto-skip when the DOM target is missing).

## TL;DR

| Piece | Exists? | Where |
|-------|---------|--------|
| Shared tour engine | Yes | [`ProductTour.tsx`](resources/js/Components/ProductTour/ProductTour.tsx) |
| Deal reference consumer | Yes | [`dealTourSteps.ts`](resources/js/Pages/Deals/Redesign/config/dealTourSteps.ts) |
| Lead tour flag / steps / targets | **New** | `crm.leads-product-tour`, `leadTourSteps.ts`, `data-tour` attrs |
| Seen-state (server + local) | Reuse | `product-tours.seen`, `useProductTour` |

## How users access each area (source of truth for copy)

| Area | How to access |
|------|----------------|
| **Photo** | Click avatar in header (needs edit permission) |
| **Lifecycle status** | Status pill next to the name |
| **Owner** | Owner card on the right of the header |
| **Qualification start/resume** | Lifecycle banner primary CTA; also AI summary “Qualify” when AI is on |
| **Qualification answers** | Header chip (when answers exist); banner “view answers”; ⋮ → View qualification answers; URL `?answers=open` |
| **Create / open deal** | Banner (qualified/converted); ⋮ → Create deal; Quick stats deal slot; Deals tab; Itinerary may prompt create |
| **Find duplicates** | ⋮ → Find duplicates (merge flag + permission); card also auto-shows when matches found |
| **Add note / task / meeting** | ⋮ menu; Overview column CTAs; dossier Quick actions; Quick stats empty-slot shortcuts |
| **Log action** | Dossier Quick actions → Log Action |
| **Edit profile / custom fields** | Lead info tab (or dossier → “Edit in Lead info”) |
| **Document slots + uploads** | Files tab (file custom fields + freeform files) |
| **Linked deals** | Deals tab; Quick stats primary deal / View all deals |
| **Flight itinerary** | Flight itinerary tab (legs across deals) |
| **Marketing signals** | Marketing tab + dossier “Marketing engagement” |
| **Activity history** | Timeline tab |
| **Replay tour** | ⋮ → Replay guide (when tour flag on) |

## Tour sequence (implemented)

`tourId`: `lead-redesign-v1`  
Flag: `crm.leads-product-tour`

Missing targets are auto-skipped by `ProductTour` (same as deals) — so AI / qualification banner steps vanish cleanly when those flags are off.

| # | Target | `onEnter` | Notes |
|---|--------|-----------|--------|
| 1 | `lead-sticky-header` | — | Identity + owner |
| 2 | `lead-status-dropdown` | — | Lifecycle change |
| 3 | `lead-lifecycle-banner` | — | Skip if `crm.lead-qualification-tab` off |
| 4 | `lead-ai-summary` | — | Skip if `crm.lead-ai-summary` off |
| 5 | `lead-quick-stats` | — | Meeting / task / deal glance |
| 6 | `lead-tabs` | — | Full tab strip |
| 7 | `lead-overview` | `setTab("overview")` | Essentials columns |
| 8 | `lead-info-sidebar` | `setTab("leadinfo")` | Editable record |
| 9 | `#lead-tab-deals` | — | Tab button spotlight |
| 10 | `#lead-tab-files` | — | Documents live here |
| 11 | `#lead-tab-timeline` | — | History |
| 12 | `lead-quick-actions` | — | Rail shortcuts |
| 13 | `lead-dossier` | — | Read-only glance; edit via Lead info |
| 14 | `lead-actions-menu` | — | ⋮ + replay |
| 15 | *(centered)* | — | Closing / replay hint |

## English copy (shipped under `pages.leads.tour`)

See `resources/lang/{eng,de,ru,tr}/pages.php` → `leads.tour.steps.*`.

## Implementation checklist

- [x] Register `crm.leads-product-tour` in `config/features.php`
- [x] `config/leadTourSteps.ts` (`LEAD_TOUR_ID`, labels, `buildLeadTourSteps`)
- [x] Lang strings in eng / de / ru / tr
- [x] `data-tour` attributes on header, banner, AI wrap, quick stats, tabs, overview, dossier, quick actions, actions menu
- [x] `DealInfoSidebar` accepts `tourTarget` (lead passes `lead-info-sidebar`)
- [x] Wire `ProductTour` + replay in `LeadViewRedesign` / `MoreMenu`
- [ ] Enable flag per environment (Infisical / feature flag admin) — **ops**

## Open questions

1. **Enable by default in prod?** Deals tour is flag-gated; recommend same for leads until content is reviewed in staging.
2. **Duplicates card as a tour step?** Omitted — intermittent presence would skip often; covered in actions-menu copy instead.

## Resolved decisions

- Reuse shared `ProductTour` engine; do not fork.
- Static `t()` lang keys (not `td()`), matching deals.
- Conditional regions rely on auto-skip rather than building a dynamic step list.
