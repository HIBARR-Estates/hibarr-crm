# Meta event funnel — what sends what

How each step of the lead funnel is reported back to Meta, and where it lives.
Browser events are sent by the **website** Meta Pixel; later-funnel events are
sent server-side by **CRM automations** through the Conversions API (CAPI).

| Meta event | Fires when | Channel | Where |
|---|---|---|---|
| `PageView` | Visitor lands on any page | Pixel | `hibarr-website` `components/analytics/MetaPixel.tsx` (base snippet) |
| `ViewContent` | Landing page: scrolled to the bottom **and** 30 s on the page (tab visible) | Pixel | `hibarr-website` `components/analytics/MetaViewContent.tsx` |
| `Lead` | Contact step of the consultation form completed (email entered), or `/capture` form saved | Pixel | `ConsultationForm` (both variants), `LeadCaptureForm` |
| `CompleteRegistration` | Qualification questions answered and the consultation registration saved | Pixel | `ConsultationForm` (both variants), mutation `onSuccess` |
| `Schedule` | Calendly booking confirmed (`calendly.event_scheduled`) | Pixel | `hibarr-website` `components/CalendlyEmbed.tsx` |
| `Contact` | Meeting logged as **Attended** (value 1500) | CAPI | CRM automation — `meeting_attended` / `lead_meeting_attended` trigger → `meta_conversion` action |
| `Purchase` | Payment received (real value) | CAPI | **Not wired yet** — see "Purchase" below |

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

## Purchase

`Purchase` needs a **real value**, but the `meta_conversion` action only sends a
fixed `meta_event_value`. Two gaps to close before this can be automated:

1. a way to send the deal's / payment's actual amount instead of a fixed number;
2. a trigger that actually runs when payment lands. Payment confirmation marks the
   deal Won (`DealPaymentService::markConfirmed`), but
   `DealAutomationService::isExcludedFromAutomations()` skips deals with a paid
   request while `packages.online-payment` is on, so a `deal_updated` automation
   would never run for them.
