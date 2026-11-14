import { useMemo } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import { groupByDay } from "../agenda/model";
import { addDays } from "../agenda/range";
import { useUpcomingDays } from "../agenda/useAgendaData";
import AddActivityMenu, { type ActivityKind } from "./AddActivityMenu";
import { DayItems, useDayItems, type MeetingHandlers } from "./DayItems";
import type { TaskHandlers } from "./TaskQueue";
import type { TodaySchedule as TodayScheduleData } from "./types";
import { isTaskDone } from "./useTodayWork";

const NEXT_DAYS = 4;

interface TodayScheduleProps extends MeetingHandlers {
    schedule: TodayScheduleData;
    today: string;
    handlers: TaskHandlers;
    /** Opens the agenda, on a given day or on today. */
    onOpenAgenda: (day?: string) => void;
    /** Opens the task or meeting form to put something on the day. */
    onAdd: (kind: ActivityKind) => void;
}

/**
 * Today's schedule: the day's meetings with the tasks that have a time, in
 * clock order, with a line at the current time. Tasks due today without a
 * time stay in the queue and are only counted here. Under it, how much the
 * next few days hold, each opening the agenda on that day.
 */
export default function TodaySchedule({ schedule, today, handlers, onOpenAgenda, onAdd, ...meetingHandlers }: TodayScheduleProps) {
    const { t, locale } = useTranslation();
    // "Mon 9 Nov", as on the board; the header above already says the full date.
    const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString(locale || undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    });
    const { items, untimed: untimedTasks } = useDayItems(schedule.meetings, schedule.tasks, handlers.timeZone);
    const untimed = untimedTasks.filter((task) => !isTaskDone(task)).length;

    return (
        <section className="agent-panel agent-schedule" aria-labelledby="agent-schedule-title">
            <header className="agent-panel__head">
                <h2 id="agent-schedule-title" className="agent-panel__title">
                    {t("pages.agent_workspace.today.schedule.title")}
                    <span className="agent-panel__title-sub"> · {dateLabel}</span>
                </h2>
                <div className="agent-panel__head-actions">
                    <AddActivityMenu onAdd={onAdd} />
                    <Button size="sm" className="agent-btn-soft" icon={<Icon name="calendar" size={13} />} onClick={() => onOpenAgenda()}>
                        {t("pages.agent_workspace.today.schedule.open_agenda")}
                    </Button>
                </div>
            </header>
            {items.length === 0 ? (
                <EmptyState
                    icon="calendar"
                    title={t("pages.agent_workspace.today.schedule.empty_title")}
                    description={t("pages.agent_workspace.today.schedule.empty_description")}
                />
            ) : (
                <DayItems items={items} handlers={handlers} meetingHandlers={meetingHandlers} nowMarker />
            )}
            {untimed > 0 ? (
                <p className="agent-panel__foot">
                    {untimed === 1
                        ? t("pages.agent_workspace.today.schedule.untimed_one")
                        : t("pages.agent_workspace.today.schedule.untimed_many", { count: untimed })}
                </p>
            ) : null}
            <NextDays today={today} timeZone={handlers.timeZone} onOpenAgenda={onOpenAgenda} />
        </section>
    );
}

/** "Next days: Tue · 3  Wed · 2 …": meetings and open tasks on each of the next days. */
function NextDays({ today, timeZone, onOpenAgenda }: { today: string; timeZone: string; onOpenAgenda: (day: string) => void }) {
    const { t, locale } = useTranslation();
    const data = useUpcomingDays(today, NEXT_DAYS);
    const days = useMemo(() => {
        if (!data) return null;
        const byDay = groupByDay(data, timeZone);
        return Array.from({ length: NEXT_DAYS }, (_, index) => {
            const key = addDays(today, index + 1);
            const day = byDay.get(key);
            const count = (day?.meetings.length ?? 0) + (day?.tasks.filter((task) => !isTaskDone(task)).length ?? 0);
            const label = new Date(`${key}T12:00:00Z`).toLocaleDateString(locale || undefined, { weekday: "short", timeZone: "UTC" });
            return { key, label, count };
        });
    }, [data, timeZone, today, locale]);

    if (!days) return null;

    return (
        <nav className="agent-next-days" aria-label={t("pages.agent_workspace.today.schedule.next_days")}>
            <span>{t("pages.agent_workspace.today.schedule.next_days")}</span>
            {days.map((day) => (
                <button key={day.key} type="button" className="agent-next-days__day" onClick={() => onOpenAgenda(day.key)}>
                    {day.label} · {day.count}
                </button>
            ))}
        </nav>
    );
}
export function TodayScheduleSkeleton() {
    return (
        <div className="agent-panel" aria-busy="true">
            <div className="dr-skeleton" style={{ height: 18, width: 180, borderRadius: 6 }} />
            {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="dr-skeleton" style={{ height: 72, borderRadius: 12, marginTop: 10 }} />
            ))}
        </div>
    );
}
