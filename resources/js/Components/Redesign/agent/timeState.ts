import { REDESIGN_TOKENS as T } from "../tokens";

/**
 * Time states used across the agent workspace (tasks, meetings, next steps):
 * overdue, happening now, soon or today, later, no date, and done. Colours
 * come from the TIME_* tokens in design-tokens.json; screens never restate them.
 */
export type TimeState = "late" | "now" | "soon" | "later" | "none" | "done";

export interface TimeStateColors {
    bg: string;
    border: string;
    text: string;
    solid: string;
}

export const TIME_STATE_COLORS: Record<TimeState, TimeStateColors> = {
    late: { bg: T.TIME_LATE_BG, border: T.TIME_LATE_BORDER, text: T.TIME_LATE_TEXT, solid: T.TIME_LATE_SOLID },
    now: { bg: T.TIME_NOW_BG, border: T.TIME_NOW_BORDER, text: T.TIME_NOW_TEXT, solid: T.TIME_NOW_SOLID },
    soon: { bg: T.TIME_SOON_BG, border: T.TIME_SOON_BORDER, text: T.TIME_SOON_TEXT, solid: T.TIME_SOON_SOLID },
    later: { bg: T.TIME_LATER_BG, border: T.TIME_LATER_BORDER, text: T.TIME_LATER_TEXT, solid: T.TIME_LATER_SOLID },
    none: { bg: T.TIME_NONE_BG, border: T.TIME_NONE_BORDER, text: T.TIME_NONE_TEXT, solid: T.TIME_NONE_SOLID },
    done: { bg: T.TIME_DONE_BG, border: T.TIME_DONE_BORDER, text: T.TIME_DONE_TEXT, solid: T.TIME_DONE_SOLID },
};

const HOUR_MS = 60 * 60 * 1000;

/** YYYY-MM-DD of an instant in `timeZone` (the browser's own when empty). */
export function dayKeyIn(instantMs: number, timeZone: string): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: timeZone || undefined,
    }).formatToParts(new Date(instantMs));
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * A task's due date is a wall-clock string in the viewer's zone
 * ("Y-m-d H:i:s", see Task::wallClockString). Midnight means "no time set":
 * the date pickers only add a time when someone picks one.
 */
export function hasDueTime(wallClock: string | null | undefined): boolean {
    if (!wallClock || wallClock.length < 16) return false;
    return wallClock.slice(11, 16) !== "00:00";
}

/** The instant a wall-clock string in `timeZone` names. */
export function wallClockToMs(wallClock: string, timeZone: string): number {
    const naive = Date.parse(`${wallClock.slice(0, 19).replace(" ", "T")}Z`);
    if (Number.isNaN(naive)) return Number.NaN;
    // Offset of the zone at that moment: format the naive instant there and
    // compare. Two passes settle the hour either side of a DST change.
    const offsetAt = (ms: number) => {
        const parts = new Intl.DateTimeFormat("en-GB", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23",
            timeZone: timeZone || undefined,
        }).formatToParts(new Date(ms));
        const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
        const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
        return asUtc - ms;
    };
    const first = naive - offsetAt(naive);
    return naive - offsetAt(first);
}

/**
 * A task's time state. Done wins; no due date is "none". A task with a time
 * is late once that time passes; a date-only task is late from the next day.
 * Due today is "soon", anything after that "later".
 */
export function taskTimeState(
    task: { due_date?: string | null; done: boolean },
    nowMs: number,
    timeZone: string,
): TimeState {
    if (task.done) return "done";
    if (!task.due_date) return "none";

    const today = dayKeyIn(nowMs, timeZone);
    const dueDay = task.due_date.slice(0, 10);

    if (hasDueTime(task.due_date)) {
        if (wallClockToMs(task.due_date, timeZone) < nowMs) return "late";
    } else if (dueDay < today) {
        return "late";
    }

    return dueDay === today ? "soon" : "later";
}

/**
 * A meeting's time state. Held is "done"; running is "now"; starting within
 * the hour is "soon". One that has ended without being marked held reads as
 * "none": it isn't urgent, it just still needs its outcome logged.
 */
export function meetingTimeState(
    meeting: { at: string | null; duration?: number | null; held: boolean },
    nowMs: number,
): TimeState {
    if (meeting.held) return "done";
    if (!meeting.at) return "none";

    const start = Date.parse(meeting.at);
    if (Number.isNaN(start)) return "none";
    const end = start + (meeting.duration ?? 30) * 60 * 1000;

    if (nowMs >= end) return "none";
    if (nowMs >= start) return "now";
    return start - nowMs <= HOUR_MS ? "soon" : "later";
}
