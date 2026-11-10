import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import { DayItems, useDayItems, type MeetingHandlers } from "./DayItems";
import type { TaskHandlers } from "./TaskQueue";
import type { TodaySchedule as TodayScheduleData } from "./types";
import { isTaskDone } from "./useTodayWork";

interface TodayScheduleProps extends MeetingHandlers {
    schedule: TodayScheduleData;
    dateLabel: string;
    handlers: TaskHandlers;
}

/**
 * Today's schedule: the day's meetings with the tasks that have a time, in
 * clock order. Tasks due today without a time stay in the queue and are only
 * counted here.
 */
export default function TodaySchedule({ schedule, dateLabel, handlers, ...meetingHandlers }: TodayScheduleProps) {
    const { t } = useTranslation();
    const { items, untimed: untimedTasks } = useDayItems(schedule.meetings, schedule.tasks, handlers.timeZone);
    const untimed = untimedTasks.filter((task) => !isTaskDone(task)).length;

    return (
        <section className="agent-panel agent-schedule" aria-labelledby="agent-schedule-title">
            <header className="agent-panel__head">
                <h2 id="agent-schedule-title" className="agent-panel__title">
                    {t("pages.agent_workspace.today.schedule.title")}
                    <span className="agent-panel__title-sub"> · {dateLabel}</span>
                </h2>
            </header>
            {items.length === 0 ? (
                <EmptyState
                    icon="calendar"
                    title={t("pages.agent_workspace.today.schedule.empty_title")}
                    description={t("pages.agent_workspace.today.schedule.empty_description")}
                />
            ) : (
                <DayItems items={items} handlers={handlers} meetingHandlers={meetingHandlers} />
            )}
            {untimed > 0 ? (
                <p className="agent-panel__foot">
                    {untimed === 1
                        ? t("pages.agent_workspace.today.schedule.untimed_one")
                        : t("pages.agent_workspace.today.schedule.untimed_many", { count: untimed })}
                </p>
            ) : null}
        </section>
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
