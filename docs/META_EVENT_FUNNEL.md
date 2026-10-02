# Meta event funnel — what sends what

How each step of the lead funnel is reported back to Meta, and where it lives.
Only browser-only signals use the **website** Meta Pixel. Everything tied to a real
lead goes through the Conversions API (CAPI): the early funnel via the **backend**, the
later funnel via **CRM automations**.

| Meta event | Fires when | Channel | Where |
|---|---|---|---|
| `PageView` | Visitor lands on any page (not scoped) | Pixel | `hibarr-website` base pixel `components/analytics/MetaPixel.tsx` |
| `ViewContent` | Tracked page: scrolled to the bottom **and** 30 s on the page (tab visible) | Pixel | `hibarr-website` `components/analytics/MetaViewContent.tsx` |
| `Lead` | Contact step completed (lead created first via `POST /leads/capture`, event sent with its uuid) | **Backend → CAPI** | website calls `hibarr-backend` `POST /v1/meta/events` |
| `CompleteRegistration` | Last qualification answer given (creates the lead first if needed) | **Backend → CAPI** | same endpoint |
| `Schedule` | Calendly booking confirmed (creates the lead first if needed) | **Backend → CAPI** | same endpoint, from the Calendly embed; the three events are independent of each other |
| `Contact` | Meeting logged as **Attended** (value 1500) | CRM → CAPI | CRM automation — `meeting_attended` trigger → `meta_conversion` action |
| `Purchase` | Payment confirmed (real value) | CRM → CAPI | CRM automation — `deal_payment_received` trigger → `meta_conversion` action with value source **Deal value** |

The pixel does **not** send `Lead`, `CompleteRegistration` or `Schedule`: they are tied to a real
lead, so the backend sends them with the lead's own verified details. The CRM keeps sending
`Contact` and `Purchase` itself (`MetaConversionsService`, Graph API `v23.0`). See
`hibarr-website/docs/meta-pixel-events.md` and `hibarr-backend/docs/CODEBASE_BRIEF.md` (Meta row).

`ViewContent`, `Lead`, `CompleteRegistration` and `Schedule` are only sent from tracked
pages — `/consultation*` and `/lp/<slug>` — configured in
`hibarr-website/src/lib/meta-tracking.config.ts` and enforced for both channels (pixel in
`trackMetaEvent()`, server events in `reportMetaEvent()`). `PageView` is unscoped. Both stay
silent in a `?noanalytics=1` session.

## Setting up the `Contact` event in the CRM

1. Settings → Automation → New automation.
2. Trigger **Meeting Attended** (`meeting_attended`) — one trigger for both subjects. Pick
   subject **Deal** for meetings attached to a deal, or subject **Lead** for meetings logged
   against a lead with no deal. A meeting only runs the automations whose subject matches what
   it is attached to: a deal meeting never runs lead automations, and a lead-only meeting never
   runs deal automations.
3. Add a **Meta conversion** action: event name `Contact`, value `1500`.
   (Add `Contact` under Meta Events first if it isn't in the picker.)

Behaviour worth knowing:

- Fires **once per meeting**, the first time its outcome becomes *Attended* —
  from the attendance confirmation prompt or the meeting's edit form. Saving an
  already-attended meeting again does not re-fire. No-show, cancelled,
  rescheduled and partial outcomes never fire it.
- Requires `crm.automation-v2` (like every `meta_conversion` action).
- A deal automation is skipped for locked deals, and — with
  `packages.online-payment` on — for deals that already have a paid request.
- Currency: `MetaConversionsService` uses the deal's currency, falling back to
  `GBP` (leads have no currency). Check that is the currency the 1500 is meant in.
- Matching quality depends on the lead's stored `fbp` / `fbc` / IP / user agent
  (captured by the backend on registration) plus hashed email/phone.
- A meeting that goes attended → another outcome → attended again would fire a
  second time (there is no per-meeting "already reported" marker).

## Setting up the `Purchase` event in the CRM

1. Settings → Automation → New automation, subject **Deal**, trigger
   **Payment Received** (`deal_payment_received`).
2. Add a **Meta conversion** action: event name `Purchase`, and under *Value*
   choose **Deal value** to send what the deal is actually worth. Choose
   **Fixed value** (the default) to send the number you type instead. The number
   is also the fallback if a "Deal value" deal has no value.

Behaviour worth knowing:

- Fires **once per payment**, when it is confirmed as paid — online payment
  settled, bank transfer confirmed in the CRM, or a completed payment pushed from
  the payment system (`DealPaymentService::markConfirmed`). It runs *after* the
  deal has been marked Won, so the deal's value is its final one.
- This is the one deal trigger that still runs for a deal with a paid request.
  Every other trigger is skipped for paid deals while `packages.online-payment`
  is on; that skip is bypassed only for `deal_payment_received`. Locked deals are
  still skipped.
- "Deal value" is the deal's `value` in the deal's own currency, and the event is
  sent with that currency (fallback `GBP`). It reads the value when the event
  fires, so later edits don't change an already-sent Purchase.
- "Deal value" only exists on deal automations; a lead automation always sends the
  fixed value. Existing actions are unchanged (no source = fixed).
- Needs `crm.automation-v2`.
