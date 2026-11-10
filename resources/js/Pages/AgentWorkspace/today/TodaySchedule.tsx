import { useMemo } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { hasDueTime, meetingTimeState, wallClockToMs, type TimeState } from "@/Components/Redesign/agent";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { toWorkspaceMeetingListItem } from "@/Pages/Deals/Redesign/adapters/meetingListAdapter";
import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";
import TaskActions from "./TaskActions";
import type { TaskHandlers } from "./TaskQueue";
import { instantTime, minutesUntil, wallTime } from "./format";
import type { TodaySchedule as TodayScheduleData } from "./types";
import { isTaskDone } from "./useTodayWork";

type Item = { kind: "meeting"; at: number; meeting: ScheduleEntry } | { kind: "task"; at: number; task: QueueTask };

interface TodayScheduleProps {
    schedule: TodayScheduleData;
    dateLabel: string;
    handlers: TaskHandlers;
    onOpenMeeting: (meeting: ScheduleEntry) => void;
    onMarkHeld: (followUpId: number) => void;
    isMarkingHeld: (followUpId: number) => boolean;
}

/**
 * Today's schedule: the day's meetings with the tasks that have a time, in
 * clock order. Tasks due today without a time stay in the queue and are only
 * counted here.
 */
export default function TodaySchedule({
    schedule,
    dateLabel,
    handlers,
    onOpenMeeting,
    onMarkHeld,
    isMarkingHeld,
}: TodayScheduleProps) {
    const { t } = useTranslation();
    const { nowMs, timeZone } = handlers;

    const { items, untimed } = useMemo(() => {
        const list: Item[] = [];
        for (const meeting of schedule.meetings) {
            if (meeting.at) list.push({ kind: "meeting", at: Date.parse(meeting.at), meeting });
        }
        let withoutTime = 0;
        for (const task of schedule.tasks) {
            if (task.due_date && hasDueTime(task.due_date)) {
                list.push({ kind: "task", at: wallClockToMs(task.due_date, timeZone), task });
            } else if (!isTaskDone(task)) {
                withoutTime += 1;
            }
        }
        list.sort((a, b) => a.at - b.at);
        return { items: list, untimed: withoutTime };
    }, [schedule, timeZone]);

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
                <ol className="agent-sched">
                    {items.map((item) =>
                        item.kind === "meeting" ? (
                            <MeetingItem
                                key={`m${item.meeting.id}`}
                                meeting={item.meeting}
                                nowMs={nowMs}
                                timeZone={timeZone}
                                onOpen={() => onOpenMeeting(item.meeting)}
                                onMarkHeld={() => onMarkHeld(item.meeting.id)}
                                markingHeld={isMarkingHeld(item.meeting.id)}
                            />
                        ) : (
                            <TaskItem key={`t${item.task.id}`} task={item.task} handlers={handlers} />
                        ),
                    )}
                </ol>
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

function MeetingItem({
    meeting,
    nowMs,
    timeZone,
    onOpen,
    onMarkHeld,
    markingHeld,
}: {
    meeting: ScheduleEntry;
    nowMs: number;
    timeZone: string;
    onOpen: () => void;
    onMarkHeld: () => void;
    markingHeld: boolean;
}) {
    const { t } = useTranslation();
    const { td } = useTd();
    const held = meeting.status === "completed";
    const state: TimeState = meetingTimeState({ at: meeting.at, duration: meeting.duration, held }, nowMs);
    const start = meeting.at ? instantTime(meeting.at, timeZone) : "";
    const endIso = meeting.at ? new Date(Date.parse(meeting.at) + meeting.duration * 60_000).toISOString() : null;
    const end = endIso ? instantTime(endIso, timeZone) : "";
    const listItem = toWorkspaceMeetingListItem(meeting);
    const where =
        listItem.locationType === "phone"
            ? t("pages.agent_workspace.today.schedule.phone")
            : listItem.locationType === "video"
              ? td(listItem.platformLabel, { source: "en" })
              : td(listItem.locationDisplay, { source: "en" });

    let stateText: string | null = null;
    if (state === "done") stateText = t("pages.agent_workspace.today.schedule.held");
    else if (state === "now") stateText = t("pages.agent_workspace.today.schedule.now_until", { time: end });
    else if (state === "soon" && meeting.at) stateText = t("pages.agent_workspace.today.schedule.in_minutes", { count: minutesUntil(meeting.at, nowMs) });
    else if (state === "none") stateText = t("pages.agent_workspace.today.schedule.ended");

    const canJoin = Boolean(meeting.meeting_link) && (state === "now" || state === "soon");
    const canMarkHeld = state === "now" || state === "none";

    return (
        <li className={`agent-sched__item agent-ts--${state}`}>
            <span className="agent-sched__time">{start}</span>
            <div className="agent-sched__card">
                <div className="agent-sched__top">
                    <button type="button" className="agent-sched__title" onClick={onOpen}>
                        {meeting.title}
                    </button>
                    {stateText ? <span className="agent-sched__state">{stateText}</span> : null}
                </div>
                <div className="agent-sched__meta">
                    <Icon name={listItem.locationType === "video" ? "video" : listItem.locationType === "phone" ? "phone" : "map-pin"} size={13} />
                    <span>{[t("pages.agent_workspace.today.schedule.meeting"), where, `${start}–${end}`].filter(Boolean).join(" · ")}</span>
                </div>
                {canJoin || canMarkHeld ? (
                    <div className="agent-sched__actions">
                        {canJoin ? (
                            <a className="dr-btn dr-btn-primary" href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">
                                <Icon name="video" size={14} />
                                {t("pages.agent_workspace.today.actions.join")}
                            </a>
                        ) : null}
                        {canMarkHeld ? (
                            <Button
                                variant={state === "none" ? "primary" : "ghost"}
                                icon={<Icon name="check" size={14} />}
                                loading={markingHeld}
                                onClick={onMarkHeld}
                            >
                                {t("pages.agent_workspace.today.actions.mark_held")}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

function TaskItem({ task, handlers }: { task: QueueTask; handlers: TaskHandlers }) {
    const { t } = useTranslation();
    const done = isTaskDone(task);
    const at = task.due_date ? wallClockToMs(task.due_date, handlers.timeZone) : Number.NaN;
    const state: TimeState = done ? "done" : at < handlers.nowMs ? "late" : at - handlers.nowMs <= 3_600_000 ? "soon" : "later";

    let stateText: string | null = null;
    if (state === "late") stateText = t("pages.agent_workspace.today.schedule.late");
    else if (state === "soon" && task.due_date) stateText = t("pages.agent_workspace.today.schedule.in_minutes", { count: Math.max(1, Math.ceil((at - handlers.nowMs) / 60_000)) });

    return (
        <li className={`agent-sched__item agent-ts--${state}`}>
            <span className="agent-sched__time">{task.due_date ? wallTime(task.due_date) : ""}</span>
            <div className="agent-sched__card">
                <div className="agent-sched__top">
                    <button type="button" className="agent-sched__title" onClick={() => handlers.onOpen(task)}>
                        {task.heading}
                    </button>
                    {stateText ? <span className="agent-sched__state">{stateText}</span> : null}
                </div>
                <div className="agent-sched__meta">
                    <Icon name="check-square" size={13} />
                    <span>{[t("pages.agent_workspace.today.schedule.task"), task.related?.name].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="agent-sched__actions">
                    <TaskActions
                        name={task.heading}
                        done={done}
                        completing={handlers.isCompleting(task.id)}
                        rescheduling={handlers.isRescheduling(task.id)}
                        onComplete={() => handlers.onComplete(task)}
                        onReschedule={() => handlers.onReschedule(task)}
                    />
                </div>
            </div>
        </li>
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
