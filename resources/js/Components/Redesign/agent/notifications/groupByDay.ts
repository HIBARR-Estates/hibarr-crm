import { dayKeyIn } from "../timeState";

export type DayGroupKey = "today" | "yesterday" | "earlier";

export interface DayGroup<T> {
    key: DayGroupKey;
    items: T[];
}

/**
 * Splits newest-first items into Today, Yesterday and Earlier, by the day in
 * the viewer's own time zone. Empty groups are left out and the order kept.
 */
export function groupByDay<T extends { created_at: string }>(items: T[], nowMs: number, timeZone: string): Array<DayGroup<T>> {
    const today = dayKeyIn(nowMs, timeZone);
    const yesterday = dayKeyIn(nowMs - 86_400_000, timeZone);
    const groups: Record<DayGroupKey, T[]> = { today: [], yesterday: [], earlier: [] };

    for (const item of items) {
        const day = dayKeyIn(Date.parse(item.created_at), timeZone);
        groups[day === today ? "today" : day === yesterday ? "yesterday" : "earlier"].push(item);
    }

    return (["today", "yesterday", "earlier"] as const).filter((key) => groups[key].length > 0).map((key) => ({ key, items: groups[key] }));
}

/** "08:00" on the group's own day for Today; weekday and time for the days before. */
export function notificationTime(createdAt: string, group: DayGroupKey, locale: string, timeZone: string): string {
    const at = new Date(createdAt);
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timeZone || undefined }).format(at);
    if (group === "today") return time;
    const day = new Intl.DateTimeFormat(locale, { weekday: "short", ...(group === "earlier" ? { day: "numeric", month: "short" } : {}), timeZone: timeZone || undefined }).format(at);
    return `${day} ${time}`;
}
