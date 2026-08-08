# Entity AI Summary — Component Spec (HIB-970)

## Overview

Reusable `EntityAiSummaryCard` for lead and deal record views. Renders structured JSON from the Lead/Deal Summary agents. First integration: legacy lead show, then lead redesign, then deal views (HIB-972).

**Feature flags:**
- Leads: `crm.lead-ai-summary`
- Deals: `sales.ai-entity-summary`

## Component anatomy

```
┌─ EntityAiSummaryCard (purple left accent) ─────────────────────────┐
│ Header: [AI icon] AI Lead Summary · refreshed 4 min ago  [Regenerate]│
├─────────────────────────────────────────────────────────────────────┤
│ Status line (1–2 sentences, risk-aware styling)                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                             │
│ │ Chip 1   │ │ Chip 2   │ │ Chip 3   │  (2–4 chips, tone-colored)   │
│ └──────────┘ └──────────┘ └──────────┘                             │
│ • Bullet 1                                                          │
│ • Bullet 2                                                          │
│ • Bullet 3                                                          │
├─ Next step footer (dark bar) ─────────────────────── [CTA button] ┤
└─────────────────────────────────────────────────────────────────────┘
```

## States

| State | UI |
|-------|-----|
| Empty | Prompt to generate; no auto-fetch on load |
| Loading | Skeleton over card body; Regenerate disabled |
| Cached | Full card; timestamp from `meta.generated_at` |
| Error | Inline message + retry |
| Low confidence | Show `data_confidence: low` badge when `meta.data_confidence === 'low'` |

## JSON contract

See `lead-summary-agent-prompt.md` OUTPUT block. TypeScript types in `resources/js/Types/entity-summary.ts`.

## Action routing

| `action_type` | Navigation |
|---------------|------------|
| `OPEN_DEAL` | `deals.show` with `target_deal_id` |
| `REVIEW_DEALS` | `lead-contact.show` with `?tab=deals` |
| `CONTACT_LEAD` / `SCHEDULE_CALL` | `tel:` if phone, else qualification tab |
| `QUALIFY_LEAD` | Qualification tab / scroll to workspace |
| `CREATE_TASK` | Workspace tasks sub-tab on deal |
| `REQUEST_DOCUMENTS` | Workspace files sub-tab on deal |
| `ADVANCE_STAGE` | Stage advance UI when provided |
| `REVIEW_STALE_DEAL` | Timeline tab on deal |
| `NO_ACTION_NEEDED` | Hide CTA |

## Placement

- **Legacy lead:** Above tabs in `LegacyLeadShow.tsx`
- **Redesign lead:** Below `LeadIdentityHeader`, above `LeadMissionBar` (coexists in v1)
- **Legacy deal:** Above `DealTabs` in `LegacyDealShow` (`Show.tsx`)
- **Redesign deal:** Below `DealStickyHeader` (stage stepper), above `DealMainTabs` in `DealViewRedesign.tsx`

## API

### Lead
- `GET /account/lead-contact/{lead}/ai-summary`
- `POST /account/lead-contact/{lead}/ai-summary/regenerate`

### Deal
- `GET /account/deals/{deal}/ai-summary`
- `POST /account/deals/{deal}/ai-summary/regenerate`

## v1 deferrals

- Regenerate dropdown chevron: button only
- `last_engagement_at`: best-effort from marketing data
- `partner_information`: omitted unless in custom fields
