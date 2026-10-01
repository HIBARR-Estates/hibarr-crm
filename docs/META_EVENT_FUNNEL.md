# Meta event funnel — what sends what

How each step of the lead funnel is reported back to Meta, and where it lives.
Browser events are sent by the **website** Meta Pixel; later-funnel events are
sent server-side by **CRM automations** through the Conversions API (CAPI).

| Meta event | Fires when | Channel | Where |
|---|---|---|---|
| `PageView` | Visitor lands on any page (not scoped) | Pixel | `hibarr-website` `components/analytics/MetaPixel.tsx` (base snippet) |
| `ViewContent` | Landing page: scrolled to the bottom **and** 30 s on the page (tab visible) | Pixel | `hibarr-website` `components/analytics/MetaViewContent.tsx` |
| `Lead` | Contact step of the consultation form completed (email entered) | Pixel | `ConsultationForm` (both variants) |
| `CompleteRegistration` | Qualification questions answered and the consultation registration saved | Pixel | `ConsultationForm` (both variants), mutation `onSuccess` |
| `Schedule` | Calendly booking confirmed (`calendly.event_scheduled`) | Pixel | `hibarr-website` `components/CalendlyEmbed.tsx` |
| `Contact` | Meeting logged as **Attended** (value 1500) | CAPI | CRM automation — `meeting_attended` / `lead_meeting_attended` trigger → `meta_conversion` action |
| `Purchase` | Payment confirmed (real value) | CAPI | CRM automation — `deal_payment_received` trigger → `meta_conversion` action with value source **Deal value** |

`ViewContent`, `Lead`, `CompleteRegistration` and `Schedule` are only sent from tracked
pages — `/consultation*` and `/lp/<slug>` — enforced in `trackMetaEvent()` by the
`TRACKED_PATH_PATTERNS` allowlist. `PageView` is unscoped.

All pixel events go through `trackMetaEvent()` (`hibarr-website/src/lib/meta-pixel.ts`),
which no-ops when the pixel isn't on the page (`?noanalytics=1`, pay routes, ad
blockers) and attaches an `eventID` to every event.

## Setting up the `Contact` event in the CRM

1. Settings → Automation → New automation.
2. Subject **Deal**, trigger **Meeting Attended** (`meeting_attended`) — or
   subject **Lead**, trigger **Lead Meeting Attended** (`lead_meeting_attended`)
   if your meetings are logged against leads with no deal. Meetings attached to a
   deal only fire the deal trigger; lead-only meetings only fire the lead trigger.
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
