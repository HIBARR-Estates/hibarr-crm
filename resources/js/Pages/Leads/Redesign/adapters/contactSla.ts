/**
 * Pure logic for the lead's first-contact timer: which state to show and what to put in it. No React,
 * so it can be tested on its own. The server decides the deadline (it counts only the channel's
 * working hours); the browser only counts down to it, against the server's clock.
 */

export type ContactMethod = "call" | "whatsapp" | "email";

export interface ContactSla {
    id: number;
    lead_entry_id: number;
    status: "awaiting_owner" | "running" | "met";
    first_contact_seconds: number;
    recommended_method: ContactMethod | null;
    window: { timezone: string; days: number[]; start: string; end: string } | null;
    owner: { id: number; name: string | null } | null;
    started_at: string | null;
    due_at: string | null;
    /** Running outside the channel's hours: the deadline waits for the window to reopen. */
    paused: boolean;
    resumes_at: string | null;
    breached: boolean;
    breached_at: string | null;
    contacted_at: string | null;
    contact_method: ContactMethod | null;
    contacted_by: { id: number; name: string | null } | null;
    used_recommended_method: boolean | null;
    elapsed_working_seconds: number | null;
    met_in_time: boolean | null;
    server_now: string;
}

export type SlaPhase =
    | "awaiting_owner"
    | "running"
    | "due_soon"
    | "overdue"
    | "paused"
    | "met"
    | "met_late";

export interface SlaView {
    phase: SlaPhase;
    /** Seconds left (running, due_soon), seconds past the deadline (overdue), or time taken (met). */
    seconds: number;
}

/** The last quarter of the limit counts as "due soon". */
const DUE_SOON_FRACTION = 0.25;

/** How far the server's clock is ahead of the browser's, so the countdown follows the server. */
export function serverOffsetMs(sla: Pick<ContactSla, "server_now">, clientNowMs: number): number {
    const server = Date.parse(sla.server_now);
    return Number.isFinite(server) ? server - clientNowMs : 0;
}

export function slaView(sla: ContactSla, nowMs: number): SlaView {
    if (sla.status === "awaiting_owner") {
        return { phase: "awaiting_owner", seconds: 0 };
    }
    if (sla.status === "met") {
        return {
            phase: sla.met_in_time === false ? "met_late" : "met",
            seconds: sla.elapsed_working_seconds ?? 0,
        };
    }

    const due = sla.due_at ? Date.parse(sla.due_at) : NaN;
    if (!Number.isFinite(due)) {
        return { phase: "running", seconds: sla.first_contact_seconds };
    }
    const remaining = Math.ceil((due - nowMs) / 1000);
    if (remaining <= 0) {
        // Past the deadline. A window that is closed does not pause an overdue clock: it is late.
        return { phase: "overdue", seconds: Math.abs(remaining) };
    }
    if (sla.paused) {
        return { phase: "paused", seconds: remaining };
    }
    return {
        phase: remaining <= sla.first_contact_seconds * DUE_SOON_FRACTION ? "due_soon" : "running",
        seconds: remaining,
    };
}

/** "04:32" under an hour, "2h 05m" from an hour up. Never negative. */
export function formatClock(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    const two = (n: number) => String(n).padStart(2, "0");
    return hours > 0 ? `${hours}h ${two(minutes)}m` : `${two(minutes)}:${two(rest)}`;
}

/** "45s", "5m", "1h 30m": the limit or time taken in short, language-neutral units. */
export function formatDurationShort(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    if (seconds < 60) return `${seconds}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

/** Whether the timer still needs to tick or poll: an ended clock never changes again. */
export function isLive(sla: ContactSla): boolean {
    return sla.status !== "met";
}
