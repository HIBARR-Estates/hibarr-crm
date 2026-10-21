import type { CrmEvent } from "@/Types/api/crm-event";

/** Resolves a lang key in the current locale. */
export type Translate = (key: string) => string;

/**
 * Formats a call duration (seconds) using the locale's own duration strings.
 *
 * `t` supplies the three shapes (`pages.call_summary.duration_*`); the params
 * are declared there so the translator controls the unit wording, not just the
 * digits.
 */
export function formatCallDuration(seconds: number, t: Translate): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return "";
    }

    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
        return t("pages.call_summary.duration_hms")
            .replace(":h", String(hours))
            .replace(":m", String(mins))
            .replace(":s", String(secs));
    }

    if (mins > 0) {
        return t("pages.call_summary.duration_ms")
            .replace(":m", String(mins))
            .replace(":s", String(secs).padStart(2, "0"));
    }

    return t("pages.call_summary.duration_s").replace(":s", String(secs));
}

/** Joins already-translated parts with the locale's separator. */
function joinParts(parts: string[], t: Translate): string {
    const separator = t("pages.call_summary.separator");
    return parts.filter((part) => part !== "").join(separator);
}

/**
 * Describes a call event in plain language, e.g.
 * "Inbound call from +49 170 · completed · 2m 05s · Recording available".
 *
 * `t` resolves every user-facing fragment — counterparty labels, outcomes,
 * duration units and the separator — from `pages.call_summary.*`. The
 * counterparty's number is interpolated into the already-translated label
 * here in the browser; it is never handed to the translation service, which
 * would otherwise ship a customer's phone number off the tenant.
 *
 * Returns null for non-call events so callers can fall back to the generic
 * event-type name.
 */
export function describeCallEvent(
    event: CrmEvent,
    t: Translate,
): string | null {
    const slug = event.event_type?.slug ?? "";
    if (!slug.startsWith("call_")) {
        return null;
    }

    const meta = event.metadata ?? {};
    const phone =
        typeof meta.phone_number === "string" && meta.phone_number.trim() !== ""
            ? meta.phone_number.trim()
            : null;
    const duration =
        typeof meta.duration === "number" ? formatCallDuration(meta.duration, t) : "";

    const counterparty = phone
        ? event.direction === "inbound"
            ? `${t("pages.call_summary.inbound_from")} ${phone}`
            : event.direction === "outbound"
              ? `${t("pages.call_summary.outbound_to")} ${phone}`
              : `${t("pages.call_summary.with")} ${phone}`
        : event.direction === "inbound"
          ? t("pages.call_summary.inbound")
          : event.direction === "outbound"
            ? t("pages.call_summary.outbound")
            : t("pages.call_summary.call");

    const outcome = (() => {
        switch (slug) {
            case "call_started":
                return t("pages.call_summary.started");
            case "call_ended":
                return t("pages.call_summary.completed");
            case "call_missed":
                return t("pages.call_summary.missed");
            case "call_declined":
                return t("pages.call_summary.declined");
            case "call_voicemail":
                return t("pages.call_summary.voicemail");
            case "call_busy":
                return t("pages.call_summary.busy");
            case "call_failed":
                return t("pages.call_summary.failed");
            default:
                return "";
        }
    })();

    const parts = [counterparty];
    if (outcome) {
        parts.push(outcome);
    }
    // Only the two outcomes that report one carry a duration, and it is a
    // part of its own so joinParts() applies the locale's separator.
    if (duration && (slug === "call_ended" || slug === "call_voicemail")) {
        parts.push(duration);
    }
    // Recording linkage is stamped onto the event once the upload completes.
    if (meta.has_recording === true || typeof meta.recording_id === "number") {
        parts.push(t("pages.call_summary.recording_available"));
    }

    return joinParts(parts, t);
}
