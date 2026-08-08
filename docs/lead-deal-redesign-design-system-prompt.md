# Claude Design — Lead & Deal Redesign Design System Prompt

Copy the **Prompt** section below into Claude Design to set up a design system grounded in the shipped HIBARR Lead/Deal redesign.

Source of truth in code:

- Tokens: `resources/js/Components/Redesign/tokens.ts`
- Shared CSS: `resources/js/Components/Redesign/redesign.css`
- Primitives: `resources/js/Components/Redesign/primitives/`
- Barrel: `resources/js/Components/Redesign/index.ts`
- Deal wrappers: `resources/js/Pages/Deals/Redesign/components/primitives/` (re-export shared system as `Deal*`)
- Lead page styles: `resources/js/Pages/Leads/Redesign/lead-redesign.css` (CSS vars mirror tokens)

---

## Prompt (paste this)

```
# HIBARR Lead & Deal Redesign — Design System Setup

You are creating a **product design system** for HIBARR CRM’s Lead and Deal detail redesign. Do **not** invent a new brand language. Reverse-engineer and formalize what already ships in production code so future screens (including dashboard, lists, etc.) can extend the same system.

Product context: real-estate / sales CRM. Dense workspace UIs (detail page + sidebar rail + modals + tabs), not a marketing site. Prefer quiet ops confidence over kitsch.

---

## 1. Brand & visual personality

- **Professional sales CRM**, calm and precise.
- **Light theme only** for redesign surfaces (no dark mode requirement).
- Surfaces sit on a cool gray canvas with white panels; primary accent is a **trust blue**; secondary structure is **deep navy**.
- Semantic colors for success (green), warning (amber), danger (red), and teal for secondary info badges.
- Font: **IBM Plex Sans** (400/500/600/700), with system-ui fallbacks.
- Avoid: purple–indigo SaaS gradients, cream + terracotta editorial, newsletter layouts, glowing glassmorphism, heavy multi-layer shadows, emoji as decoration, over-rounded “full pill every chip” clutter beyond the defined badge system.

---

## 2. Tokens (exact values from code — use these hexes)

### Color — `REDESIGN_TOKENS`

| Token | Hex | Role |
|-------|-----|------|
| BG | `#f5f6f8` | Page / canvas background |
| SURFACE | `#ffffff` | Cards, panels, modals |
| SURFACE_2 | `#f8f9fb` | Nested surface / soft wells |
| NAVY | `#16294d` | Strong brand structure, nav pills text, agent avatars, primary navy buttons |
| BLUE | `#1a6bb5` | Primary actions, active accents, primary buttons |
| BLUE_LIGHT | `#e8f1fb` | Soft blue fills (pills, focus rings soft) |
| BLUE_MID | `#b8d4f0` | Blue borders, focus outline |
| BLUE_DARK | `#14538c` | Text/icons on light blue |
| BLUE_HOVER | `#145890` | Link / ghost-hover blue |
| GREEN | `#177a5b` | Success, participant avatars |
| GREEN_LIGHT | `#e1f5ee` | Success soft fill |
| GREEN_MID | `#9fe1cb` | Success border |
| AMBER | `#92400e` | Warning text |
| AMBER_SOFT | `#fff7ed` | Warning soft fill |
| AMBER_BANNER | `#fef3c7` | Banner warning strip |
| AMBER_MID | `#fed7aa` | Warning border |
| AMBER_TEXT | `#b45309` | Banner warning copy |
| AMBER_BG | `#fffbeb` | Alt warning bg |
| AMBER_BORDER | `#fde68a` | Alt warning border |
| RED | `#b91c1c` | Danger / high priority |
| RED_SOFT | `#fef2f2` | Danger soft fill |
| RED_MID | `#fecaca` | Danger border |
| TEAL | `#0f766e` | Informational secondary |
| TEAL_SOFT | `#e6f7f5` | Teal soft fill |
| TEAL_MID | `#99e2d8` | Teal border |
| GRAY | `#f5f6f8` | Neutral chip fill |
| GRAY_MID | `#e8eaed` | Subtle dividers / scrollbar |
| GRAY_DARK | `#5b6472` | Muted UI chrome |
| GRAY_DARKER | `#374151` | Stronger gray |
| BORDER | `#e2e5ea` | Default borders |
| BORDER_SOFT | `#eef0f3` | Soft separators |
| TEXT | `#1a1f2e` | Primary text |
| TEXT_MUTED | `#5b6472` | Secondary text |
| TEXT_HINT | `#9ca3af` | Tertiary / placeholder-adjacent |
| WHITE | `#ffffff` | |
| SKELETON | `#eef1f5` | Loading shimmer |
| NAVY_SOFT | `#e8ecf2` | Navy pill fill |
| NAVY_MID | `#c7d0de` | Navy pill border |

**Overlay (modals):** `rgba(22, 41, 77, 0.45)` (navy at 45% opacity).

**Button primary hover (CSS):** primary `#155fa0`, navy hover `#0f1c38`.

> Note: Lead page CSS vars (`--lr-*`) mostly mirror the above; a few lead-only tints exist for lifecycle (pink, orange, purple soft). Prefer the shared token table for the core system; treat lifecycle extras as **status extensions**.

### Typography — `REDESIGN_TYPE` (px only — these are the allowed type sizes)

| Token | Size | Use |
|-------|------|-----|
| CAPTION | 12 | Uppercase field labels, meta rows, small buttons, pills |
| BODY | 14 | Default body / table / form |
| BODY_LG | 15 | Emphasised body, card titles |
| HEADING | 16 | Panel & modal headings |
| DISPLAY | 19 | Prominent facts (meeting date, task title) |

**Weights:** 400 regular, 500 medium, 600 semibold (buttons, pills), 700 bold (field labels uppercase, avatars).

**Field label pattern:** 12px, weight 700, color TEXT_MUTED, uppercase, letter-spacing ~0.05em.

**Font stack:** `'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

Do **not** introduce extra ad-hoc `text-[13px]` style variants unless they map to CAPTION/BODY.

### Radius — `REDESIGN_RADIUS`

| Token | Value | Use |
|-------|-------|-----|
| SM | 6 | Inputs-small chips, editable hit targets |
| MD | 8 | Buttons, inputs, cards, panels (default) |
| LG | 12 | Emphasis containers (date tiles, highlight panels) |
| FULL | 999 | Pills, avatars |

**Modals:** panel border-radius **14px** (exception — document as `radius.modal = 14`).

### Spacing (observed conventions)

- Button base: padding `9px 16px`, gap `7px`, min-height `32px`
- Button sm: padding `5px 10px`, min-height `28px`
- Input padding: `10–11px 12px`
- Modal body: `20px 22px`
- Modal footer: `14px 22px`, top border `1px BORDER`
- Modal overlay padding: `24px`
- Badge / pill padding: `4px 11px`, gap `4px`
- Scrollbars: 4px thumb, GRAY_MID

### Elevation / borders

- Default border: `1px solid BORDER`
- Modal shadow: `0 20px 50px rgba(22, 41, 77, 0.18)`
- Prefer border over deep shadow for cards
- Focus ring for inputs: border `BLUE_MID` + box-shadow `0 0 0 2px BLUE_LIGHT`

### Motion

- Buttons: background/color ~0.12s
- Light micro interactions (pipeline dots scale 1.2) ~0.15s
- No continuous thrash; field flash outline for jump-to-field: 1.6s ease-out blue pulse

---

## 3. Component inventory (build these in the design system)

Shared code lives under `Components/Redesign`. Deal detail re-exports many as `DealButton`, `DealBadge`, etc. — **same components**.

### 3.1 Button (`Button` / `.dr-btn`)

**Variants**

| Variant | Style |
|---------|--------|
| `primary` | bg BLUE, text white; hover darker blue |
| `navy` | bg NAVY, text white; hover deeper navy |
| `ghost` | bg white, text TEXT_MUTED, 1px BORDER; hover TEXT on BG fill |

**Sizes:** `base` (13px text) · `sm` (12px)

**Anatomy:** inline-flex, icon optional left of label, loading = spinner, disabled opacity 0.45.

**Usage**

- Primary: main page/modal commit (Save, Schedule)
- Navy: high-emphasis brand actions when blue is already primary CTAs nearby
- Ghost: cancel, secondary, table actions

### 3.2 Badge / Pill (`Badge` / `.dr-pill`)

Pill shape FULL radius, 12px / 600, 4×11 padding, 1px semantic border.

| Variant | bg / text / border tokens |
|---------|---------------------------|
| blue | BLUE_LIGHT / BLUE_DARK / BLUE_MID |
| green | GREEN_LIGHT / GREEN / GREEN_MID |
| gray | GRAY / GRAY_DARK / BORDER |
| navy | NAVY_SOFT / NAVY / NAVY_MID |
| amber | AMBER_SOFT / AMBER / AMBER_MID |
| red | RED_SOFT / RED / RED_MID |
| teal | TEAL_SOFT / TEAL / TEAL_MID |

**Semantic mappings in product**

- Priority: high→red, medium→amber, low→gray (`PriorityBadge`)
- Lead temperature: cold→blue, warm→amber, hot→red
- Stages / statuses / types: choose closest semantic pill; do not invent rainbow chips

### 3.3 Avatar

Types:

- `agent` — NAVY fill, white initials
- `participant` — GREEN fill, white initials
- `watcher` — BG fill, TEXT_MUTED, 1px BORDER (outlined)
- `default` — BLUE fill, white initials

Default size 28; circle; weight 700; optional photo `src` cover-crop. Lead header avatar often larger (~48) with white ring + soft border.

### 3.4 Icon

Thin stroke SVG set used in redesign (calendar, users, etc.). Use simple 24 grid strokes, aligned with product Icon primitive — not filled Material icons unless matching existing paths.

### 3.5 Modal

- Portaled full-screen overlay, centered panel max-width **520** default (override allowed for rich editors)
- Header: title HEADING weight + close control (`PanelHeader`)
- Body pad 20×22; footer optional, top border, actions right-aligned typical ghost Cancel + primary Confirm
- **Dirty mode:** block accidental dismiss (backdrop / Escape) while form dirty; X and Cancel still close
- Focus trap; body scroll lock
- ConfirmDialog variant for destructive / skip flows (`danger` confirm styling, confirmLoading)

### 3.6 ModalField (form labels)

Uppercase CAPTION labels + full-width input/select/textarea with MD radius and blue focus ring (see tokens).

### 3.7 Input (`.dr-input`)

White fill, BORDER, radius MD, 13px body-ish, placeholder TEXT_MUTED, blue focus ring as above.

### 3.8 Editable field

Inline value looks static until hover/focus: dashed underline in BLUE_MID, optional pencil fade-in. Single-click activate pattern.

### 3.9 Empty state

White surface, BORDER, radius MD (~8/lg rounded), centered title BODY medium TEXT, optional CAPTION description TEXT_MUTED, generous padding (~p-8).

### 3.10 Panel header

For section panels and modal headers — title + optional actions/close.

### 3.11 Date block

Emphasis date tile (radius LG) for meetings/tasks dates.

### 3.12 Switch, SelectCheckbox, MenuSelect

Custom redesign controls (not default Ant chrome). Keep compact; use token borders and BLUE selection accents.

### 3.13 Pickers

- **AgentPicker** — choose a sales agent
- **PeoplePicker** — multi people / participants  
  Dense list + avatars; popover/menu positioning via floating menu hook.

### 3.14 File primitives

- **FileDropzone** — upload target using tokens
- **AttachmentFileCard** — file row/card

### 3.15 CompletionDot, ProgressRing, BulkActionBar, ScrollArrow, PriorityBadge

Supporting chrome for checklists, progress, multi-select toolbars, horizontal scroll cues.

### 3.16 Higher-order patterns (compose primitives)

Modals already in product (document as composed examples):

- AddTask · TaskDetail
- AddNote · NoteDetail  
- ScheduleMeeting · EditMeeting · RescheduleMeeting · MeetingDetail
- Itinerary (+ OCR scanner)

**Page-level patterns (Lead + Deal)** — not atomic tokens but system layouts:

| Pattern | Description |
|---------|-------------|
| Soft page canvas | BG full height, IBM Plex 14 |
| Sticky header | Identity + primary CTAs + badges |
| Pipeline / lifecycle stepper | Stage chips / steps with interaction |
| Workspace tabs | Text tabs (mtab), muted → hover TEXT |
| Context rail | Secondary info column |
| Info side panels | Grouped fields with CAPTION labels |
| Card list items | Task/meeting/note cards in white surface + border |
| Banner | Lifecycle / warning strips (amber banner tokens) |

---

## 4. Layout principles (Lead / Deal detail)

1. **Workspace, not dashboard wall of charts** — focus is record work.
2. **Header identity first** — person or deal name, status pills, owners/agents as avatars.
3. **Primary action clear** — one primary button weight per region; rest ghost.
4. **Two-tier structure** common: main workspace tabs + secondary deal/lead info rail or sections.
5. **Deferred content** may skeleton; use SKELETON color.
6. **Mutation feels instant** — design optimistic UIs; avoid full-page reload metaphors.
7. **Density:** tight but readable; CAPTION floor is 12px — nothing smaller for sustained reading.
8. Cards optional for interactive units; avoid stacking decorative card chrome that isn't structural.

---

## 5. Do / Don't

**Do**

- Use exact token hex values
- Use only type scale steps
- Use existing button variants and badge variants
- Uppercase captions for form field labels
- Navy overlay + soft modal shadow for dialogs
- Semantic pills for status; map temperature and priority as defined

**Don't**

- Introduce a second primary brand color
- Use Ant Design default blue as the system primary for redesign surfaces
- Use Inter/Roboto as the face of redesign (IBM Plex Sans is brand for these pages)
- Invent quotas, spend charts, or BI on record pages
- Overuse full-round pills for large containers (FULL is for chips/avatars only)
- Multi-elevation card stacks with heavy shadow cascades

---

## 6. Deliverables from this design system setup

1. **Token set** in Figma/Claude Design: color, type, radius, spacing, effect (overlay, focus, modal shadow)
2. **Components** with states: default / hover / focus / disabled / loading as applicable  
   - Button (3 variants × 2 sizes)  
   - Badge (7 variants)  
   - Avatar (4 types)  
   - Input + ModalField  
   - Modal + ConfirmDialog  
   - EmptyState  
   - DateBlock  
   - Switch / Checkbox / MenuSelect  
   - AgentPicker / PeoplePicker (representative)  
   - FileDropzone / AttachmentFileCard  
   - PriorityBadge  
   - PanelHeader / BulkActionBar
3. **Example compositions**  
   - Modal: Schedule meeting footer (ghost + primary)  
   - Lead header: avatar + name + temperature pill + ghost/primary actions  
   - Deal header: value + stage + agent avatars  
   - Empty task tab  
   - Destructive confirm
4. **Usage notes** for pairing with engineering path `@/Components/Redesign`

---

## 7. Naming

Prefer shared names over domain prefix:

- Button (not only DealButton)
- Badge / PriorityBadge
- Tokens: `REDESIGN_TOKENS` / `REDESIGN_TYPE` / `REDESIGN_RADIUS`

Domain wrappers (`DealButton`) are code aliases only.

---

## 8. Success check

A new screen designed with this system should look like it belongs next to Lead View Redesign and Deal View Redesign without a separate skin: same canvas gray, same IBM Plex, same blue/navy actions, same pills, same modal treatment.
```

---

## Quick engineer reference

| Concern | Path |
|---------|------|
| Tokens | `Components/Redesign/tokens.ts` |
| Buttons/pills/inputs CSS | `Components/Redesign/redesign.css` (`.dr-btn*`, `.dr-pill*`, `.dr-input`) |
| React primitives | `Components/Redesign/primitives/*` |
| Public exports | `Components/Redesign/index.ts` |
| Deal re-exports | `Pages/Deals/Redesign/components/primitives/*` + `Pages/Deals/Redesign/tokens.ts` |
| Lead CSS vars | `Pages/Leads/Redesign/lead-redesign.css` |
| Lead temperature mapping | `Pages/Leads/Redesign/config/leadTemperature.ts` |
