import { Link } from "@inertiajs/react";
import { useMemo } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { hasDueTime, meetingTimeState, taskTimeState, wallClockToMs, type TimeState } from "@/Components/Redesign/agent";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { toWorkspaceMeetingListItem } from "@/Pages/Deals/Redesign/adapters/meetingListAdapter";
import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";
import TaskActions from "./TaskActions";
import { recordHref, type TaskHandlers } from "./TaskQueue";
import { instantTime, minutesUntil, wallTime } from "./format";
import { isTaskDone } from "./useTodayWork";

export type DayItem = { kind: "meeting"; at: number; meeting: ScheduleEntry } | { kind: "task"; at: number; task: QueueTask };

export interface MeetingHandlers {
    onOpenMeeting: (meeting: ScheduleEntry) => void;
    onMarkHeld: (followUpId: number) => void;
    isMarkingHeld: (followUpId: number) => boolean;
}

/**
 * A day's meetings and timed tasks in clock order. Tasks without a time are
 * returned apart: they belong to the day, not to a slot in it.
 */
export function buildDayItems(meetings: ScheduleEntry[], tasks: QueueTask[], timeZone: string) {
    const items: DayItem[] = [];
    const untimed: QueueTask[] = [];
    for (const meeting of meetings) {
        if (meeting.at) items.push({ kind: "meeting", at: Date.parse(meeting.at), meeting });
    }
    for (const task of tasks) {
        if (task.due_date && hasDueTime(task.due_date)) {
            items.push({ kind: "task", at: wallClockToMs(task.due_date, timeZone), task });
        } else {
            untimed.push(task);
        }
    }
    items.sort((a, b) => a.at - b.at);
    return { items, untimed };
}

/** Hook form of buildDayItems, memoised on its inputs. */
export function useDayItems(meetings: ScheduleEntry[], tasks: QueueTask[], timeZone: string) {
    return useMemo(() => buildDayItems(meetings, tasks, timeZone), [meetings, tasks, timeZone]);
}

/**
 * Schedule cards for one day: meetings with Join and Mark held, tasks with
 * Done and Reschedule. `layout="grid"` lays them out side by side (the
 * agenda's day preview) instead of down a timeline.
 */
export function DayItems({
    items,
    handlers,
    meetingHandlers,
    layout = "timeline",
    showRecordLink = false,
}: {
    items: DayItem[];
    handlers: TaskHandlers;
    meetingHandlers: MeetingHandlers;
    layout?: "timeline" | "grid";
    showRecordLink?: boolean;
}) {
    return (
        <ol className={`agent-sched${layout === "grid" ? " agent-sched--grid" : ""}`}>
            {items.map((item) =>
                item.kind === "meeting" ? (
                    <MeetingItem
                        key={`m${item.meeting.id}`}
                        meeting={item.meeting}
                        nowMs={handlers.nowMs}
                        timeZone={handlers.timeZone}
                        onOpen={() => meetingHandlers.onOpenMeeting(item.meeting)}
                        onMarkHeld={() => meetingHandlers.onMarkHeld(item.meeting.id)}
                        markingHeld={meetingHandlers.isMarkingHeld(item.meeting.id)}
                        showRecordLink={showRecordLink}
                    />
                ) : (
                    <TaskItem key={`t${item.task.id}`} task={item.task} handlers={handlers} showRecordLink={showRecordLink} />
                ),
            )}
        </ol>
    );
}

function MeetingItem({
    meeting,
    nowMs,
    timeZone,
    onOpen,
    onMarkHeld,
    markingHeld,
    showRecordLink,
}: {
    meeting: ScheduleEntry;
    nowMs: number;
    timeZone: string;
    onOpen: () => void;
    onMarkHeld: () => void;
    markingHeld: boolean;
    showRecordLink: boolean;
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

    const canJoin = Boolean(listItem.meetingLink) && (state === "now" || state === "soon");
    const canMarkHeld = state === "now" || state === "none";
    const record = meeting.deal_id
        ? { href: route("deals.show", meeting.deal_id), label: t("pages.agent_workspace.agenda.open_deal") }
        : meeting.lead_id
          ? { href: route("agent.people.show", meeting.lead_id), label: t("pages.agent_workspace.agenda.open_lead") }
          : null;
    const recordLink = showRecordLink && record;

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
                {canJoin || canMarkHeld || recordLink ? (
                    <div className="agent-sched__actions">
                        {canJoin ? (
                            <a className="dr-btn dr-btn-primary" href={listItem.meetingLink ?? undefined} target="_blank" rel="noopener noreferrer">
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
                        {recordLink ? (
                            <Link className="dr-btn dr-btn-ghost" href={record.href}>
                                {record.label}
                            </Link>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

function TaskItem({ task, handlers, showRecordLink }: { task: QueueTask; handlers: TaskHandlers; showRecordLink: boolean }) {
    const { t } = useTranslation();
    const done = isTaskDone(task);
    const timed = Boolean(task.due_date && hasDueTime(task.due_date));
    const at = timed && task.due_date ? wallClockToMs(task.due_date, handlers.timeZone) : Number.NaN;
    // A task with a time turns "soon" an hour ahead, like a meeting; one with
    // only a date is soon all its day.
    const state: TimeState = !timed
        ? taskTimeState({ due_date: task.due_date, done }, handlers.nowMs, handlers.timeZone)
        : done
          ? "done"
          : at < handlers.nowMs
            ? "late"
            : at - handlers.nowMs <= 3_600_000
              ? "soon"
              : "later";

    let stateText: string | null = null;
    if (state === "late") stateText = t("pages.agent_workspace.today.schedule.late");
    else if (state === "soon" && timed) stateText = t("pages.agent_workspace.today.schedule.in_minutes", { count: Math.max(1, Math.ceil((at - handlers.nowMs) / 60_000)) });

    return (
        <li className={`agent-sched__item agent-ts--${state}`}>
            <span className="agent-sched__time">{timed && task.due_date ? wallTime(task.due_date) : t("pages.agent_workspace.agenda.any_time")}</span>
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
                    {showRecordLink && task.related ? (
                        <Link className="dr-btn dr-btn-ghost" href={recordHref(task.related)}>
                            {task.related.type === "lead"
                                ? t("pages.agent_workspace.agenda.open_lead")
                                : t("pages.agent_workspace.agenda.open_deal")}
                        </Link>
                    ) : null}
                </div>
            </div>
        </li>
    );
}
