import useTranslation from "@/Hooks/useTranslation";
import type { ScheduleEntry } from "@/Types/personal-work";
import type { TaskHandlers } from "../today/TaskQueue";
import { instantTime, wallTime } from "../today/format";
import { daySummary, useOrderedDay } from "./DayPreview";
import { dayOrEmpty, hasTime, meetingState, taskState, type AgendaDay } from "./model";

/** Chips a cell shows before the rest fold into "+N more". */
const MAX_CHIPS = 3;

interface AgendaMonthProps {
    /** Whole weeks, Monday first. */
    days: string[];
    month: string;
    byDay: Map<string, AgendaDay>;
    today: string;
    selected: string;
    handlers: TaskHandlers;
    onSelect: (day: string) => void;
    onOpenMeeting: (meeting: ScheduleEntry) => void;
}

/**
 * The month as a grid of days. On a desktop each day lists its first few
 * meetings and tasks; on a phone it shows dots. Clicking a day previews it.
 */
export default function AgendaMonth({ days, month, byDay, today, selected, handlers, onSelect, onOpenMeeting }: AgendaMonthProps) {
    const { locale } = useTranslation();
    const weekdays = days.slice(0, 7).map((key) =>
        new Date(`${key}T12:00:00Z`).toLocaleDateString(locale || undefined, { weekday: "short", timeZone: "UTC" }),
    );

    return (
        <section className="agent-panel agent-mo">
            <div className="agent-mo__weekdays" aria-hidden="true">
                {weekdays.map((label) => (
                    <span key={label}>{label}</span>
                ))}
            </div>
            <div className="agent-mo__grid">
                {days.map((key) => (
                    <MonthCell
                        key={key}
                        dayKey={key}
                        day={dayOrEmpty(byDay, key)}
                        outside={key.slice(0, 7) !== month}
                        isToday={key === today}
                        isSelected={key === selected}
                        handlers={handlers}
                        onSelect={onSelect}
                        onOpenMeeting={onOpenMeeting}
                    />
                ))}
            </div>
        </section>
    );
}

function MonthCell({
    dayKey,
    day,
    outside,
    isToday,
    isSelected,
    handlers,
    onSelect,
    onOpenMeeting,
}: {
    dayKey: string;
    day: AgendaDay;
    outside: boolean;
    isToday: boolean;
    isSelected: boolean;
    handlers: TaskHandlers;
    onSelect: (day: string) => void;
    onOpenMeeting: (meeting: ScheduleEntry) => void;
}) {
    const { t, locale } = useTranslation();
    const { nowMs, timeZone } = handlers;
    const items = useOrderedDay(day, timeZone);
    const shown = items.slice(0, MAX_CHIPS);
    const more = items.length - shown.length;
    const label = new Date(`${dayKey}T12:00:00Z`).toLocaleDateString(locale || undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
    });

    const classes = ["agent-mo__cell"];
    if (outside) classes.push("agent-mo__cell--outside");
    if (isToday) classes.push("agent-mo__cell--today");
    if (isSelected) classes.push("agent-mo__cell--selected");

    return (
        <div className={classes.join(" ")} onClick={() => onSelect(dayKey)}>
            <button
                type="button"
                className="agent-mo__date"
                aria-pressed={isSelected}
                aria-label={`${label} · ${daySummary(day, t)}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect(dayKey);
                }}
            >
                {Number(dayKey.slice(8, 10))}
            </button>
            <div className="agent-mo__chips">
                {shown.map((item) => {
                    if (item.kind === "meeting") {
                        const { meeting } = item;
                        return (
                            <button
                                key={`m${meeting.id}`}
                                type="button"
                                className={`agent-mo__chip agent-ts--${meetingState(meeting, nowMs)}`}
                                title={meeting.title}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onOpenMeeting(meeting);
                                }}
                            >
                                {meeting.at ? <b>{instantTime(meeting.at, timeZone)}</b> : null} {meeting.title}
                            </button>
                        );
                    }
                    const { task } = item;
                    return (
                        <button
                            key={`t${task.id}`}
                            type="button"
                            className={`agent-mo__chip agent-mo__chip--task agent-ts--${taskState(task, nowMs, timeZone)}`}
                            title={task.heading}
                            onClick={(event) => {
                                event.stopPropagation();
                                handlers.onOpen(task);
                            }}
                        >
                            {hasTime(task) && task.due_date ? <b>{wallTime(task.due_date)}</b> : null} {task.heading}
                        </button>
                    );
                })}
                {more > 0 ? (
                    <button
                        type="button"
                        className="agent-mo__more"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelect(dayKey);
                        }}
                    >
                        {t("pages.agent_workspace.agenda.more", { count: more })}
                    </button>
                ) : null}
            </div>
            {items.length > 0 ? (
                <span className="agent-mo__dots" aria-hidden="true">
                    {items.slice(0, 4).map((item) => (
                        <span
                            key={item.kind === "meeting" ? `m${item.meeting.id}` : `t${item.task.id}`}
                            className={`agent-mo__dot agent-ts--${
                                item.kind === "meeting" ? meetingState(item.meeting, nowMs) : taskState(item.task, nowMs, timeZone)
                            }`}
                        />
                    ))}
                </span>
            ) : null}
        </div>
    );
}
