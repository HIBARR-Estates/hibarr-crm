import useTranslation from "@/Hooks/useTranslation";
import { DayItems, useDayItems, type DayItem, type MeetingHandlers } from "../today/DayItems";
import type { TaskHandlers } from "../today/TaskQueue";
import type { AgendaDay } from "./model";
import { addDays } from "./range";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** "2 meetings · 1 task", or "Nothing planned". */
export function daySummary(day: AgendaDay, t: Translate): string {
    const key = "pages.agent_workspace.agenda.count";
    const parts: string[] = [];
    const meetings = day.meetings.length;
    const tasks = day.tasks.length;
    if (meetings > 0) parts.push(meetings === 1 ? t(`${key}.meetings_one`) : t(`${key}.meetings_many`, { count: meetings }));
    if (tasks > 0) parts.push(tasks === 1 ? t(`${key}.tasks_one`) : t(`${key}.tasks_many`, { count: tasks }));
    return parts.length > 0 ? parts.join(" · ") : t(`${key}.nothing`);
}

/** "Today · Tuesday 10 November", "Tomorrow · …", or just the date. */
export function dayHeading(key: string, today: string, locale: string, t: Translate): string {
    const label = new Date(`${key}T12:00:00Z`).toLocaleDateString(locale || undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
    });
    if (key === today) return `${t("pages.agent_workspace.agenda.today_prefix")} · ${label}`;
    if (key === addDays(today, 1)) return `${t("pages.agent_workspace.agenda.tomorrow_prefix")} · ${label}`;
    return label;
}

/** Timed items in clock order, then the day's tasks that have no time. */
export function useOrderedDay(day: AgendaDay, timeZone: string): DayItem[] {
    const { items, untimed } = useDayItems(day.meetings, day.tasks, timeZone);
    return [...items, ...untimed.map((task): DayItem => ({ kind: "task", at: Number.POSITIVE_INFINITY, task }))];
}

interface DayPreviewProps {
    dayKey: string;
    day: AgendaDay;
    today: string;
    handlers: TaskHandlers;
    meetingHandlers: MeetingHandlers;
    /** Shown on desktop week and month: the preview sits above the grid. */
    hint?: boolean;
}

/**
 * Everything on one day, as full cards with their actions. Sits above the
 * week and month grids (and in a sheet on a phone's month view).
 */
export default function DayPreview({ dayKey, day, today, handlers, meetingHandlers, hint = false }: DayPreviewProps) {
    const { t, locale } = useTranslation();
    const items = useOrderedDay(day, handlers.timeZone);
    const headingId = `agent-preview-${dayKey}`;

    return (
        <section className="agent-panel agent-preview" aria-labelledby={headingId}>
            <header className="agent-panel__head">
                <h2 id={headingId} className="agent-preview__title">
                    {dayHeading(dayKey, today, locale, t)}
                    <span className="agent-panel__title-sub"> · {daySummary(day, t)}</span>
                </h2>
                {hint ? <span className="agent-preview__hint">{t("pages.agent_workspace.agenda.preview_hint")}</span> : null}
            </header>
            {items.length > 0 ? (
                <DayItems items={items} handlers={handlers} meetingHandlers={meetingHandlers} layout="grid" showRecordLink />
            ) : (
                <p className="agent-preview__empty">{t("pages.agent_workspace.agenda.day_empty")}</p>
            )}
        </section>
    );
}
