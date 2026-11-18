import { dayKeyIn } from "@/Components/Redesign/agent";
import type { LeadQualification } from "@/Types/qualification";

/** A qualified lead whose consultation link went out and who has not booked yet. */
export interface BookingPending {
    /** The Calendly link the agent opened at the wrap-up. */
    url: string;
    /** When the link was opened (the action run completed). */
    openedAt: string | null;
    /** When the qualification was completed. */
    qualifiedAt: string | null;
    answers: number;
}

const SAFE_URL = /^https?:\/\//i;

/**
 * Booking pending (canvas L7-26): the latest completed qualification ended
 * with "Book consultation", so the agent opened a Calendly link at the
 * wrap-up. The booking itself happens on Calendly's side and its webhook
 * creates the deal and the first meeting; until then the lead stays on its
 * own page, which is the only place this is asked. Nothing new is stored:
 * the completed action run already carries the link.
 */
export function bookingPendingOf(qualification: LeadQualification | null | undefined): BookingPending | null {
    if (!qualification || qualification.status !== "completed") return null;
    const run = (qualification.action_runs ?? []).find((item) => {
        const url = item.payload?.calendlyUrl;
        return item.action_type === "book_consultation" && item.status === "completed" && typeof url === "string" && SAFE_URL.test(url);
    });
    if (!run) return null;

    return {
        url: run.payload?.calendlyUrl as string,
        openedAt: run.completed_at ?? null,
        qualifiedAt: qualification.completed_at ?? null,
        answers: qualification.answers?.length ?? 0,
    };
}

/** "today 09:20" or "12 Nov 09:20", in the agent's time zone. */
export function stampIn(iso: string, nowMs: number, timeZone: string, locale: string, todayLabel: string): string {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return "";
    const time = new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);
    const day =
        dayKeyIn(ms, timeZone) === dayKeyIn(nowMs, timeZone)
            ? todayLabel.toLocaleLowerCase(locale)
            : new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short" }).format(ms);
    return `${day} ${time}`;
}

/** "Jana" from "Jana Hoffmann": the boards address the client by first name here. */
export function firstNameOf(name: string | null | undefined): string {
    return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
