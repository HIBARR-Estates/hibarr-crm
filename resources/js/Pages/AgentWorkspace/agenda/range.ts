/**
 * Day arithmetic for the agenda. Days are "YYYY-MM-DD" keys in the viewer's
 * zone; the maths runs on UTC noon so no zone or DST change can move a day.
 */

export type AgendaView = "list" | "week" | "month";

export const AGENDA_VIEWS: AgendaView[] = ["list", "week", "month"];

/** Days the list view covers, starting at its date. */
export const LIST_DAYS = 7;

function toMs(key: string): number {
    return Date.parse(`${key}T12:00:00Z`);
}

function toKey(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

export function isDayKey(value: string | null | undefined): value is string {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toMs(value));
}

export function addDays(key: string, days: number): string {
    return toKey(toMs(key) + days * 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: string): number {
    return (new Date(toMs(key)).getUTCDay() + 6) % 7;
}

export function startOfWeek(key: string): string {
    return addDays(key, -weekdayIndex(key));
}

export function startOfMonth(key: string): string {
    return `${key.slice(0, 7)}-01`;
}

export function addMonths(key: string, months: number): string {
    const date = new Date(toMs(key));
    const day = date.getUTCDate();
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    return toKey(target.getTime());
}

export function daysBetween(from: string, to: string): number {
    return Math.round((toMs(to) - toMs(from)) / 86_400_000);
}

export interface AgendaRange {
    from: string;
    to: string;
    /** Every day from `from` to `to`. */
    days: string[];
}

function rangeOf(from: string, to: string): AgendaRange {
    const days: string[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
    return { from, to, days };
}

/**
 * The days a view shows for a date: seven days from it (list), its Monday to
 * Sunday (week), or the whole weeks around its month (month grid).
 */
export function rangeFor(view: AgendaView, date: string): AgendaRange {
    if (view === "list") return rangeOf(date, addDays(date, LIST_DAYS - 1));
    if (view === "week") {
        const monday = startOfWeek(date);
        return rangeOf(monday, addDays(monday, 6));
    }
    const first = startOfMonth(date);
    const last = addDays(addMonths(first, 1), -1);
    return rangeOf(startOfWeek(first), addDays(startOfWeek(last), 6));
}

/** The date one step back (-1) or forward (+1) in a view. */
export function shiftDate(view: AgendaView, date: string, direction: -1 | 1): string {
    if (view === "list") return addDays(date, direction * LIST_DAYS);
    if (view === "week") return addDays(date, direction * 7);
    return addMonths(date, direction);
}
