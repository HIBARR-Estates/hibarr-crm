import { dayKeyIn, hasDueTime, type TimeState } from "@/Components/Redesign/agent";
import { companyTimeDayjsFormat } from "@/lib/companyDateTime";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezonePlugin from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Clock time of an instant in the viewer's zone, in the company's time format. */
export function instantTime(iso: string, timeZone: string): string {
    const value = dayjs(iso);
    return (timeZone ? value.tz(timeZone) : value).format(companyTimeDayjsFormat());
}

/** Clock time of a wall-clock string ("Y-m-d H:i:s"), which is already in the viewer's zone. */
export function wallTime(wallClock: string): string {
    return dayjs(wallClock.slice(0, 19)).format(companyTimeDayjsFormat());
}

function dayDiff(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "2 days late", "Today 14:00", "Tomorrow", "Thursday" … for a task's due date. */
export function taskDueText(
    dueDate: string | null | undefined,
    state: TimeState,
    nowMs: number,
    timeZone: string,
    locale: string,
    t: Translate,
): string {
    if (state === "done") return t("pages.agent_workspace.today.due.done");
    if (!dueDate) return t("pages.agent_workspace.today.due.none");

    const today = dayKeyIn(nowMs, timeZone);
    const day = dueDate.slice(0, 10);
    const timed = hasDueTime(dueDate);
    const time = timed ? wallTime(dueDate) : "";
    const late = dayDiff(day, today);

    if (state === "late") {
        if (late <= 0) return t("pages.agent_workspace.today.due.late_since", { time });
        return late === 1
            ? t("pages.agent_workspace.today.due.late_one")
            : t("pages.agent_workspace.today.due.late_many", { count: late });
    }
    if (day === today) {
        return timed ? t("pages.agent_workspace.today.due.today_at", { time }) : t("pages.agent_workspace.today.due.today");
    }
    if (dayDiff(today, day) === 1) {
        return timed
            ? t("pages.agent_workspace.today.due.tomorrow_at", { time })
            : t("pages.agent_workspace.today.due.tomorrow");
    }
    const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString(locale || undefined, {
        weekday: "long",
        timeZone: "UTC",
    });
    return timed ? `${weekday} ${time}` : weekday;
}

/** Minutes from now until an instant, rounded up so "in 0 min" never shows. */
export function minutesUntil(iso: string, nowMs: number): number {
    return Math.max(1, Math.ceil((Date.parse(iso) - nowMs) / 60_000));
}
