import { useMemo, type CSSProperties } from "react";
import dayjs from "dayjs";
import useTranslation from "@/Hooks/useTranslation";
import { companyTimeDayjsFormat } from "@/lib/companyDateTime";
import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";
import type { TaskHandlers } from "../today/TaskQueue";
import { instantTime, wallTime } from "../today/format";
import { daySummary } from "./DayPreview";
import { dayOrEmpty, hasTime, meetingState, minuteOfDay, placeBlocks, taskMinute, taskState, type AgendaDay } from "./model";

const HOUR_PX = 48;
/** The working day shown when nothing falls outside it. */
const DEFAULT_FIRST_HOUR = 8;
const DEFAULT_LAST_HOUR = 19;
/** A task has no length; it gets this much room on the grid. */
const TASK_MINUTES = 30;

type Block = { kind: "meeting"; meeting: ScheduleEntry } | { kind: "task"; task: QueueTask };

interface AgendaWeekProps {
    days: string[];
    byDay: Map<string, AgendaDay>;
    today: string;
    selected: string;
    handlers: TaskHandlers;
    onSelect: (day: string) => void;
    onOpenMeeting: (meeting: ScheduleEntry) => void;
    /** Meetings still waiting on "did it happen?": outlined red with a "!". */
    needOutcome: ReadonlySet<number>;
}

function weekdayLabel(key: string, locale: string): string {
    return new Date(`${key}T12:00:00Z`).toLocaleDateString(locale || undefined, {
        weekday: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}

/**
 * Phone week: the seven days as a strip of buttons. The selected day's cards
 * show under it (see Agenda), and swiping them moves a day.
 */
export function WeekStrip({ days, byDay, today, selected, onSelect }: Pick<AgendaWeekProps, "days" | "byDay" | "today" | "selected" | "onSelect">) {
    const { t, locale } = useTranslation();
    return (
        <div className="agent-strip" role="group" aria-label={t("pages.agent_workspace.agenda.view_week")}>
            {days.map((key) => {
                const day = dayOrEmpty(byDay, key);
                const count = day.meetings.length + day.tasks.length;
                return (
                    <button
                        key={key}
                        type="button"
                        className={`agent-strip__day${key === today ? " agent-strip__day--today" : ""}`}
                        aria-pressed={key === selected}
                        aria-label={`${weekdayLabel(key, locale)} · ${daySummary(day, t)}`}
                        onClick={() => onSelect(key)}
                    >
                        <span className="agent-strip__weekday">
                            {new Date(`${key}T12:00:00Z`).toLocaleDateString(locale || undefined, { weekday: "short", timeZone: "UTC" })}
                        </span>
                        <span className="agent-strip__num">{Number(key.slice(8, 10))}</span>
                        <span className="agent-strip__dots" aria-hidden="true">
                            {count > 0 ? <span className="agent-strip__dot" /> : null}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Desktop and tablet week: seven columns on an hour grid, meetings as long
 * as they last, timed tasks as short blocks, tasks with no time in a row of
 * their own. Clicking a column previews that day above the grid; clicking a
 * block opens it.
 */
export default function AgendaWeek({ days, byDay, today, selected, handlers, onSelect, onOpenMeeting, needOutcome }: AgendaWeekProps) {
    const { t, locale } = useTranslation();
    const { nowMs, timeZone } = handlers;

    const columns = useMemo(
        () =>
            days.map((key) => {
                const day = dayOrEmpty(byDay, key);
                const blocks: Array<{ item: Block; start: number; end: number }> = [];
                for (const meeting of day.meetings) {
                    if (!meeting.at) continue;
                    const start = minuteOfDay(Date.parse(meeting.at), timeZone);
                    blocks.push({ item: { kind: "meeting", meeting }, start, end: start + Math.max(15, meeting.duration || 30) });
                }
                const untimed: QueueTask[] = [];
                for (const task of day.tasks) {
                    if (hasTime(task) && task.due_date) {
                        const start = taskMinute(task.due_date);
                        blocks.push({ item: { kind: "task", task }, start, end: start + TASK_MINUTES });
                    } else {
                        untimed.push(task);
                    }
                }
                return { key, placed: placeBlocks(blocks), untimed };
            }),
        [days, byDay, timeZone],
    );

    let first = DEFAULT_FIRST_HOUR;
    let last = DEFAULT_LAST_HOUR;
    for (const column of columns) {
        for (const block of column.placed) {
            first = Math.min(first, Math.floor(block.start / 60));
            last = Math.max(last, Math.ceil(Math.min(block.end, 24 * 60) / 60));
        }
    }
    const hours = Array.from({ length: last - first }, (_, index) => first + index);
    const top = (minute: number) => ((minute - first * 60) / 60) * HOUR_PX;
    const anyUntimed = columns.some((column) => column.untimed.length > 0);
    const nowMinute = minuteOfDay(nowMs, timeZone);
    const timeFormat = companyTimeDayjsFormat();

    return (
        <section className="agent-panel agent-wk" aria-label={t("pages.agent_workspace.agenda.view_week")}>
            <div className="agent-wk__row agent-wk__head">
                <span />
                {days.map((key) => (
                    <button
                        key={key}
                        type="button"
                        className={`agent-wk__day${key === today ? " agent-wk__day--today" : ""}`}
                        aria-pressed={key === selected}
                        onClick={() => onSelect(key)}
                    >
                        <span>{weekdayLabel(key, locale)}</span>
                    </button>
                ))}
            </div>
            {anyUntimed ? (
                <div className="agent-wk__row agent-wk__allday">
                    <span className="agent-wk__allday-label">{t("pages.agent_workspace.agenda.any_time")}</span>
                    {columns.map((column) => (
                        <div key={column.key} className="agent-wk__allday-cell">
                            {column.untimed.map((task) => (
                                <button
                                    key={task.id}
                                    type="button"
                                    className={`agent-wk__chip agent-wk__chip--task agent-ts--${taskState(task, nowMs, timeZone)}`}
                                    onClick={() => handlers.onOpen(task)}
                                    title={task.heading}
                                >
                                    {task.heading}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            ) : null}
            <div className="agent-wk__row agent-wk__body" style={{ height: hours.length * HOUR_PX }}>
                <div className="agent-wk__hours" aria-hidden="true">
                    {hours.map((hour) => (
                        <span key={hour} style={{ top: top(hour * 60) }}>
                            {dayjs().hour(hour).minute(0).format(timeFormat)}
                        </span>
                    ))}
                </div>
                {columns.map((column) => (
                    <div
                        key={column.key}
                        className={`agent-wk__col${column.key === selected ? " agent-wk__col--selected" : ""}`}
                        onClick={() => onSelect(column.key)}
                    >
                        {column.placed.map(({ item, start, end, lane, lanes }) => {
                            const style: CSSProperties = {
                                top: top(start),
                                height: Math.max(22, ((end - start) / 60) * HOUR_PX - 2),
                                left: `calc(${(lane / lanes) * 100}% + 2px)`,
                                width: `calc(${100 / lanes}% - 4px)`,
                            };
                            // Under 45 minutes there is only room for one line.
                            const short = end - start < 45;
                            if (item.kind === "meeting") {
                                const { meeting } = item;
                                const state = meetingState(meeting, nowMs);
                                const open = needOutcome.has(meeting.id);
                                return (
                                    <button
                                        key={`m${meeting.id}`}
                                        type="button"
                                        className={`agent-wk__block agent-ts--${state}${open ? " agent-wk__block--outcome" : ""}`}
                                        style={style}
                                        title={meeting.title}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onOpenMeeting(meeting);
                                        }}
                                    >
                                        {open ? <b aria-hidden="true">! </b> : state === "done" ? <span aria-hidden="true">✓ </span> : null}
                                        <span className="agent-wk__block-time">{meeting.at ? instantTime(meeting.at, timeZone) : ""}</span>{" "}
                                        <span className="agent-wk__block-title">{meeting.person || meeting.title}</span>
                                        {meeting.type && !short ? <span className="agent-wk__block-sub">{meeting.type}</span> : null}
                                    </button>
                                );
                            }
                            const { task } = item;
                            return (
                                <button
                                    key={`t${task.id}`}
                                    type="button"
                                    className={`agent-wk__block agent-wk__block--task agent-ts--${taskState(task, nowMs, timeZone)}`}
                                    style={style}
                                    title={task.heading}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handlers.onOpen(task);
                                    }}
                                >
                                    <span className="agent-wk__block-time">{task.due_date ? wallTime(task.due_date) : ""}</span>{" "}
                                    <span className="agent-wk__block-title">{task.heading}</span>
                                </button>
                            );
                        })}
                        {column.key === today && nowMinute >= first * 60 && nowMinute <= last * 60 ? (
                            <div className="agent-wk__now" style={{ top: top(nowMinute) }} aria-hidden="true" />
                        ) : null}
                    </div>
                ))}
            </div>
        </section>
    );
}
