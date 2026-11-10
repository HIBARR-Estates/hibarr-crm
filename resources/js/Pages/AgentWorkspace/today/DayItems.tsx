import { Link } from "@inertiajs/react";
import { useMemo, type CSSProperties } from "react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { hasDueTime, meetingTimeState, taskTimeState, wallClockToMs, type TimeState } from "@/Components/Redesign/agent";
import { meetingPlatformColor, REDESIGN_TOKENS } from "@/Components/Redesign/tokens";
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

export type DayItemsLayout = "timeline" | "list";

/**
 * Schedule cards for one day: meetings with Join and Mark held, tasks with
 * Done and Reschedule. `timeline` is Today's schedule (time beside the card),
 * `list` the agenda's list (time inside a single-line row with the platform's
 * colour bar).
 */
export function DayItems({
    items,
    handlers,
    meetingHandlers,
    layout = "timeline",
    showRecordLink = false,
    nowMarker = false,
}: {
    items: DayItem[];
    handlers: TaskHandlers;
    meetingHandlers: MeetingHandlers;
    layout?: DayItemsLayout;
    showRecordLink?: boolean;
    /** Draws the current time between the items (today's timeline). */
    nowMarker?: boolean;
}) {
    // The line goes before the first item that starts after now.
    const nowIndex = nowMarker ? items.findIndex((item) => item.at > handlers.nowMs) : -1;
    const nowAt = nowMarker ? (nowIndex === -1 ? items.length : nowIndex) : -1;
    const nowLine =
        nowAt >= 0 ? (
            <li key="now" className="agent-sched__now" aria-hidden="true">
                <span>{instantTime(new Date(handlers.nowMs).toISOString(), handlers.timeZone)}</span>
            </li>
        ) : null;

    return (
        <ol className={`agent-sched${layout === "timeline" ? "" : ` agent-sched--${layout}`}`}>
            {items.flatMap((item, index) => [
                index === nowAt ? nowLine : null,
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
                        layout={layout}
                    />
                ) : (
                    <TaskItem key={`t${item.task.id}`} task={item.task} handlers={handlers} showRecordLink={showRecordLink} layout={layout} />
                ),
            ])}
            {nowAt === items.length ? nowLine : null}
        </ol>
    );
}

/**
 * What a meeting card shows, worked out once for the schedule, the agenda
 * list and the day strip: its time state and chip, "Type · Person", where it
 * happens, the "Deal · stage" line, its platform colour and which actions
 * apply.
 */
export function useMeetingView(meeting: ScheduleEntry, nowMs: number, timeZone: string) {
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

    // "Kick Off · Thomas Becker": the meeting type and who it is with, as on
    // the boards; the deal name when either is missing.
    const heading = meeting.type && meeting.person ? `${td(meeting.type, { source: "en" })} · ${meeting.person}` : meeting.title;
    const recordLine = meeting.deal_id
        ? [t("pages.agent_workspace.today.record.deal"), meeting.deal_stage ? td(meeting.deal_stage, { source: "en" }) : null].filter(Boolean).join(" · ")
        : meeting.lead_id
          ? t("pages.agent_workspace.today.record.lead")
          : null;
    const barColor = listItem.locationType === "video" ? meetingPlatformColor(meeting.location) : REDESIGN_TOKENS.NAVY;

    const canJoin = Boolean(listItem.meetingLink) && (state === "now" || state === "soon");
    const canMarkHeld = state === "now" || state === "none";
    const record = meeting.deal_id
        ? route("agent.deals.show", meeting.deal_id)
        : meeting.lead_id
          ? route("agent.people.show", meeting.lead_id)
          : null;

    return { state, start, end, where, stateText, heading, recordLine, barColor, canJoin, canMarkHeld, record, listItem };
}

function MeetingItem({
    meeting,
    nowMs,
    timeZone,
    onOpen,
    onMarkHeld,
    markingHeld,
    showRecordLink,
    layout,
}: {
    meeting: ScheduleEntry;
    nowMs: number;
    timeZone: string;
    onOpen: () => void;
    onMarkHeld: () => void;
    markingHeld: boolean;
    showRecordLink: boolean;
    layout: DayItemsLayout;
}) {
    const { t } = useTranslation();
    const { state, start, end, where, stateText, heading, recordLine, barColor, canJoin, canMarkHeld, record, listItem } = useMeetingView(
        meeting,
        nowMs,
        timeZone,
    );
    const list = layout === "list";

    return (
        <li className={`agent-sched__item agent-ts--${state}`} style={list ? ({ "--agent-bar": barColor } as CSSProperties) : undefined}>
            <span className="agent-sched__time">{start}</span>
            <div className="agent-sched__card">
                <div className="agent-sched__text">
                    <div className="agent-sched__top">
                        <button type="button" className="agent-sched__title" onClick={onOpen}>
                            {heading}
                        </button>
                        {stateText ? (
                            <span className="agent-sched__state">
                                <span className="agent-sched__state-dot" aria-hidden="true" />
                                {stateText}
                            </span>
                        ) : null}
                    </div>
                    {list ? (
                        <div className="agent-sched__meta">
                            <span className="agent-sched__platform">{where}</span>
                            <span>{["", recordLine, `${start}–${end}`].filter((part) => part !== null).join(" · ")}</span>
                        </div>
                    ) : (
                        <div className="agent-sched__meta">
                            <Icon name={listItem.locationType === "video" ? "video" : listItem.locationType === "phone" ? "phone" : "map-pin"} size={12} />
                            <span>{[where, `${start}–${end}`].filter(Boolean).join(" · ")}</span>
                        </div>
                    )}
                </div>
                {canJoin || canMarkHeld || (showRecordLink && record) ? (
                    <div className="agent-sched__actions">
                        {canJoin ? (
                            <a className="dr-btn dr-btn-primary dr-btn-sm" href={listItem.meetingLink ?? undefined} target="_blank" rel="noopener noreferrer">
                                <Icon name="video" size={13} />
                                {t("pages.agent_workspace.today.actions.join")}
                            </a>
                        ) : null}
                        {canMarkHeld ? (
                            <Button
                                size="sm"
                                variant={state === "none" && !canJoin ? "primary" : "ghost"}
                                icon={<Icon name="check" size={13} />}
                                loading={markingHeld}
                                onClick={onMarkHeld}
                            >
                                {t("pages.agent_workspace.today.actions.mark_held")}
                            </Button>
                        ) : null}
                        {showRecordLink && record ? (
                            <Link className="dr-btn dr-btn-ghost dr-btn-sm" href={record}>
                                {t("pages.agent_workspace.agenda.contact_page")}
                            </Link>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </li>
    );
}

/**
 * A task's place in the day: done or not, whether it has a clock time, and
 * its time state. A task with a time turns "soon" an hour ahead, like a
 * meeting; one with only a date is soon all its day.
 */
export function taskView(task: QueueTask, nowMs: number, timeZone: string) {
    const done = isTaskDone(task);
    const timed = Boolean(task.due_date && hasDueTime(task.due_date));
    const at = timed && task.due_date ? wallClockToMs(task.due_date, timeZone) : Number.NaN;
    const state: TimeState = !timed
        ? taskTimeState({ due_date: task.due_date, done }, nowMs, timeZone)
        : done
          ? "done"
          : at < nowMs
            ? "late"
            : at - nowMs <= 3_600_000
              ? "soon"
              : "later";
    return { done, timed, at, state };
}

function TaskItem({
    task,
    handlers,
    showRecordLink,
    layout,
}: {
    task: QueueTask;
    handlers: TaskHandlers;
    showRecordLink: boolean;
    layout: DayItemsLayout;
}) {
    const { t } = useTranslation();
    const { done, timed, at, state } = taskView(task, handlers.nowMs, handlers.timeZone);

    let stateText: string | null = null;
    if (state === "late") stateText = t("pages.agent_workspace.today.schedule.late");
    else if (state === "soon" && timed) stateText = t("pages.agent_workspace.today.schedule.in_minutes", { count: Math.max(1, Math.ceil((at - handlers.nowMs) / 60_000)) });

    const who = task.related?.person || task.related?.name;

    return (
        <li
            className={`agent-sched__item agent-sched__item--task agent-ts--${state}`}
            style={layout === "list" ? ({ "--agent-bar": REDESIGN_TOKENS.BLUE } as CSSProperties) : undefined}
        >
            <span className="agent-sched__time">{timed && task.due_date ? wallTime(task.due_date) : t("pages.agent_workspace.agenda.any_time")}</span>
            <div className="agent-sched__card">
                <div className="agent-sched__text">
                    <div className="agent-sched__top">
                        <button type="button" className="agent-sched__title" onClick={() => handlers.onOpen(task)}>
                            {task.heading}
                        </button>
                        {stateText ? (
                            <span className="agent-sched__state">
                                <span className="agent-sched__state-dot" aria-hidden="true" />
                                {stateText}
                            </span>
                        ) : null}
                    </div>
                    <div className="agent-sched__meta">
                        <Icon name="check-square" size={12} />
                        <span>{[t("pages.agent_workspace.today.schedule.task"), who].filter(Boolean).join(" · ")}</span>
                    </div>
                </div>
                <div className="agent-sched__actions">
                    {showRecordLink ? (
                        <TaskActions
                            name={task.heading}
                            done={done}
                            size="sm"
                            completing={handlers.isCompleting(task.id)}
                            rescheduling={handlers.isRescheduling(task.id)}
                            onComplete={() => handlers.onComplete(task)}
                            onReschedule={() => handlers.onReschedule(task)}
                        />
                    ) : (
                        <TaskActions
                            name={task.heading}
                            done={done}
                            size="sm"
                            doneOnly
                            completing={handlers.isCompleting(task.id)}
                            onComplete={() => handlers.onComplete(task)}
                            onReschedule={() => handlers.onReschedule(task)}
                        />
                    )}
                    {showRecordLink && task.related ? (
                        <Link className="dr-btn dr-btn-ghost dr-btn-sm" href={recordHref(task.related)}>
                            {t("pages.agent_workspace.agenda.contact_page")}
                        </Link>
                    ) : null}
                </div>
            </div>
        </li>
    );
}
