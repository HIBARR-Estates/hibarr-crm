import { Link } from "@inertiajs/react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";
import { taskView, useDayItems, useMeetingView, type DayItem, type MeetingHandlers } from "../today/DayItems";
import TaskActions from "../today/TaskActions";
import { RecordBadge, type TaskHandlers } from "../today/TaskQueue";
import { wallTime } from "../today/format";
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
    /**
     * At most this many cards (desktop week and month: 3, as on the boards);
     * the rest are counted with a link to the day in the list. Left out on a
     * phone, where every item gets a card.
     */
    max?: number;
    /** Opens the list at this day, for the items the strip leaves out. */
    onOpenList?: (day: string) => void;
}

/**
 * The selected day as a strip of cards above the week and month grids
 * (canvas L7-03, L7-04): its meetings, upcoming ones first, then one card
 * for its open tasks ("13:00 · Task · +1 more"). On a phone's week and
 * month sheet every meeting and task gets its own card.
 */
export default function DayPreview({ dayKey, day, today, handlers, meetingHandlers, hint = false, max, onOpenList }: DayPreviewProps) {
    const { t, locale } = useTranslation();
    const items = useOrderedDay(day, handlers.timeZone);
    const headingId = `agent-preview-${dayKey}`;

    const meetings = items.filter((item): item is Extract<DayItem, { kind: "meeting" }> => item.kind === "meeting");
    const openTasks = items
        .filter((item): item is Extract<DayItem, { kind: "task" }> => item.kind === "task")
        .filter((item) => !taskView(item.task, handlers.nowMs, handlers.timeZone).done);
    // Upcoming and running meetings lead; the ones already over follow.
    const ordered = [
        ...meetings.filter((item) => meetingIsAhead(item.meeting, handlers.nowMs)),
        ...meetings.filter((item) => !meetingIsAhead(item.meeting, handlers.nowMs)),
    ];

    const grouped = max !== undefined;
    const taskCards = grouped ? (openTasks.length > 0 ? 1 : 0) : openTasks.length;
    const meetingSlots = grouped ? Math.max(0, max - taskCards) : ordered.length;
    const shownMeetings = ordered.slice(0, meetingSlots);
    // Left out of the strip: meetings past the cap, and in grouped mode the
    // open tasks folded into the first task card's "+N more".
    const hidden = ordered.length - shownMeetings.length + (grouped ? Math.max(0, openTasks.length - 1) : 0);
    // The list shows the whole day, done tasks included, so its count is the day's.
    const total = items.length;

    return (
        <section className="agent-panel agent-preview" aria-labelledby={headingId}>
            <header className="agent-panel__head">
                <h2 id={headingId} className="agent-preview__title">
                    {dayHeading(dayKey, today, locale, t)}
                    <span className="agent-panel__title-sub"> · {daySummary(day, t)}</span>
                </h2>
                {hidden > 0 && onOpenList ? (
                    <Button size="sm" className="agent-btn-soft" icon={<Icon name="list" size={13} />} onClick={() => onOpenList(dayKey)}>
                        {t("pages.agent_workspace.agenda.strip_see_all", { count: total })}
                    </Button>
                ) : hint ? (
                    <span className="agent-preview__hint">{t("pages.agent_workspace.agenda.preview_hint")}</span>
                ) : null}
            </header>
            {total > 0 ? (
                <div className="agent-daycards">
                    {shownMeetings.map((item) => (
                        <MeetingCard key={`m${item.meeting.id}`} meeting={item.meeting} handlers={handlers} meetingHandlers={meetingHandlers} />
                    ))}
                    {grouped
                        ? openTasks[0]
                            ? <TaskCard task={openTasks[0].task} more={openTasks.length - 1} handlers={handlers} />
                            : null
                        : openTasks.map((item) => <TaskCard key={`t${item.task.id}`} task={item.task} more={0} handlers={handlers} />)}
                    {shownMeetings.length === 0 && openTasks.length === 0 ? (
                        <p className="agent-preview__empty">{t("pages.agent_workspace.agenda.strip_all_done")}</p>
                    ) : null}
                </div>
            ) : (
                <p className="agent-preview__empty">{t("pages.agent_workspace.agenda.day_empty")}</p>
            )}
        </section>
    );
}

/** Not over yet: running now or still to come. */
function meetingIsAhead(meeting: ScheduleEntry, nowMs: number): boolean {
    if (!meeting.at || meeting.status === "completed") return false;
    return Date.parse(meeting.at) + meeting.duration * 60_000 > nowMs;
}

function MeetingCard({ meeting, handlers, meetingHandlers }: { meeting: ScheduleEntry; handlers: TaskHandlers; meetingHandlers: MeetingHandlers }) {
    const { t } = useTranslation();
    const view = useMeetingView(meeting, handlers.nowMs, handlers.timeZone);

    return (
        <article className={`agent-daycard agent-ts--${view.state}`}>
            <div className="agent-daycard__top">
                <span className="agent-daycard__time">{view.end ? `${view.start} – ${view.end}` : view.start}</span>
                {view.stateText ? (
                    <span className="agent-sched__state">
                        <span className="agent-sched__state-dot" aria-hidden="true" />
                        {view.stateText}
                    </span>
                ) : null}
            </div>
            <button type="button" className="agent-daycard__title" onClick={() => meetingHandlers.onOpenMeeting(meeting)}>
                {view.heading}
            </button>
            <p className="agent-daycard__meta">
                <span className="agent-daycard__platform" style={{ color: view.barColor }}>
                    {view.where}
                </span>
                {view.recordLine ? ` · ${view.recordLine}` : null}
            </p>
            <div className="agent-daycard__actions">
                {view.canJoin ? (
                    <a className="dr-btn dr-btn-primary dr-btn-sm" href={view.listItem.meetingLink ?? undefined} target="_blank" rel="noopener noreferrer">
                        <Icon name="video" size={13} />
                        {t("pages.agent_workspace.today.actions.join")}
                    </a>
                ) : null}
                {view.canMarkHeld ? (
                    <Button
                        size="sm"
                        variant={view.canJoin ? "ghost" : "primary"}
                        icon={<Icon name="check" size={13} />}
                        loading={meetingHandlers.isMarkingHeld(meeting.id)}
                        onClick={() => meetingHandlers.onMarkHeld(meeting.id)}
                    >
                        {t("pages.agent_workspace.today.actions.mark_held")}
                    </Button>
                ) : null}
                {view.record ? (
                    <Link className="dr-btn dr-btn-ghost dr-btn-sm" href={view.record}>
                        {t("pages.agent_workspace.agenda.contact_page")}
                    </Link>
                ) : null}
            </div>
        </article>
    );
}

/** The day's first open task, with how many more there are. */
function TaskCard({ task, more, handlers }: { task: QueueTask; more: number; handlers: TaskHandlers }) {
    const { t } = useTranslation();
    const { timed } = taskView(task, handlers.nowMs, handlers.timeZone);
    const time = timed && task.due_date ? wallTime(task.due_date) : t("pages.agent_workspace.agenda.any_time");
    const label = [time, t("pages.agent_workspace.today.schedule.task"), more > 0 ? t("pages.agent_workspace.agenda.strip_more", { count: more }) : null]
        .filter(Boolean)
        .join(" · ");
    const who = task.related?.person || task.related?.name;

    return (
        <article className="agent-daycard agent-daycard--task">
            <div className="agent-daycard__top">
                <span className="agent-daycard__time">{label}</span>
            </div>
            <button type="button" className="agent-daycard__title" onClick={() => handlers.onOpen(task)}>
                {who ? `${task.heading} · ${who}` : task.heading}
            </button>
            {task.related ? (
                <p className="agent-daycard__meta">
                    <RecordBadge record={task.related} />
                </p>
            ) : null}
            <div className="agent-daycard__actions">
                <TaskActions
                    name={task.heading}
                    done={false}
                    size="sm"
                    completing={handlers.isCompleting(task.id)}
                    rescheduling={handlers.isRescheduling(task.id)}
                    onComplete={() => handlers.onComplete(task)}
                    onReschedule={() => handlers.onReschedule(task)}
                />
            </div>
        </article>
    );
}
