import { Link } from "@inertiajs/react";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { taskTimeState, type TimeState } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import type { QueueTask, RelatedRecord } from "@/Types/personal-work";
import TaskActions from "./TaskActions";
import { taskDueText } from "./format";
import type { PersonalQueue } from "./types";
import { isTaskDone } from "./useTodayWork";

export interface TaskHandlers {
    nowMs: number;
    timeZone: string;
    onOpen: (task: QueueTask) => void;
    onComplete: (task: QueueTask) => void;
    onReschedule: (task: QueueTask) => void;
    isCompleting: (taskId: number) => boolean;
    isRescheduling: (taskId: number) => boolean;
}

export function recordHref(record: RelatedRecord): string {
    return record.type === "lead" ? route("agent.people.show", record.id) : route("agent.deals.show", record.id);
}

function useTaskView(task: QueueTask, handlers: TaskHandlers) {
    const { t, locale } = useTranslation();
    const done = isTaskDone(task);
    const state: TimeState = taskTimeState({ due_date: task.due_date, done }, handlers.nowMs, handlers.timeZone);
    const due = taskDueText(task.due_date, state, handlers.nowMs, handlers.timeZone, locale, t);
    return { t, done, state, due };
}

function RecordLink({ record }: { record: RelatedRecord }) {
    const { t } = useTranslation();
    return (
        <Link href={recordHref(record)} className="agent-record-link">
            <span className="agent-record-link__type">
                {record.type === "lead"
                    ? t("pages.agent_workspace.today.record.lead")
                    : t("pages.agent_workspace.today.record.deal")}
            </span>
            <span className="agent-record-link__name">{record.name}</span>
        </Link>
    );
}

/** The first open task in due-date order, given the room to act on it. */
export function NextUpCard({ task, handlers }: { task: QueueTask; handlers: TaskHandlers }) {
    const { t, done, state, due } = useTaskView(task, handlers);
    const name = task.related?.name ?? task.heading;

    return (
        <section className={`agent-next agent-ts--${state}`} aria-labelledby="agent-next-title">
            <Avatar initials={initialsFromName(name)} size={52} />
            <div className="agent-next__body">
                <span className="agent-next__eyebrow">
                    {t("pages.agent_workspace.today.next.label")} · {due}
                </span>
                <button type="button" id="agent-next-title" className="agent-next__title" onClick={() => handlers.onOpen(task)}>
                    {task.heading}
                </button>
                {task.related ? <RecordLink record={task.related} /> : null}
            </div>
            <div className="agent-next__actions">
                <TaskActions
                    name={task.heading}
                    done={done}
                    emphasis
                    completing={handlers.isCompleting(task.id)}
                    rescheduling={handlers.isRescheduling(task.id)}
                    onComplete={() => handlers.onComplete(task)}
                    onReschedule={() => handlers.onReschedule(task)}
                />
            </div>
        </section>
    );
}

function QueueRow({ task, handlers }: { task: QueueTask; handlers: TaskHandlers }) {
    const { done, state, due } = useTaskView(task, handlers);
    const name = task.related?.name ?? task.heading;

    return (
        <li className={`agent-q__row agent-ts--${state}${done ? " is-done" : ""}`}>
            <Avatar initials={initialsFromName(name)} size={32} />
            <div className="agent-q__body">
                <button type="button" className="agent-q__title" onClick={() => handlers.onOpen(task)}>
                    {task.heading}
                </button>
                <div className="agent-q__meta">
                    <span className="agent-q__due">{due}</span>
                    {task.related ? <RecordLink record={task.related} /> : null}
                </div>
            </div>
            <TaskActions
                name={task.heading}
                done={done}
                emphasis={state === "late"}
                completing={handlers.isCompleting(task.id)}
                rescheduling={handlers.isRescheduling(task.id)}
                onComplete={() => handlers.onComplete(task)}
                onReschedule={() => handlers.onReschedule(task)}
            />
        </li>
    );
}

/**
 * My work: the queue in its own due-date order. The first open task is lifted
 * into a card; the rest follow as rows. Counts come from the server's totals,
 * which are not capped like the rows are.
 */
export default function TaskQueue({
    queue,
    windowDays,
    handlers,
}: {
    queue: PersonalQueue;
    windowDays: number;
    handlers: TaskHandlers;
}) {
    const { t } = useTranslation();
    const first = queue.tasks.find((task) => !isTaskDone(task));
    const rest = queue.tasks.filter((task) => task !== first);
    const total = queue.counts.overdue + queue.counts.today + queue.counts.later;
    const { leads, deals } = queue.uncovered;

    if (!first && rest.length === 0) {
        return (
            <section className="agent-panel">
                <EmptyState
                    icon="check-square"
                    title={t("pages.agent_workspace.today.queue.empty_title")}
                    description={t("pages.agent_workspace.today.queue.empty_description", { days: windowDays })}
                />
            </section>
        );
    }

    return (
        <>
            {first ? <NextUpCard task={first} handlers={handlers} /> : null}
            <section className="agent-panel" aria-labelledby="agent-queue-title">
                <header className="agent-panel__head">
                    <h2 id="agent-queue-title" className="agent-panel__title">
                        {t("pages.agent_workspace.today.queue.title")}
                    </h2>
                    <a className="dr-btn dr-btn-ghost dr-btn-sm" href={route("tasks.index")}>
                        {t("pages.agent_workspace.today.queue.all_tasks")}
                        <Icon name="chevron-right" size={13} />
                    </a>
                </header>
                <p className="agent-panel__summary">
                    {t("pages.agent_workspace.today.queue.counts", {
                        overdue: queue.counts.overdue,
                        today: queue.counts.today,
                        later: queue.counts.later,
                    })}
                </p>
                {rest.length > 0 ? (
                    <ul className="agent-q">
                        {rest.map((task) => (
                            <QueueRow key={task.id} task={task} handlers={handlers} />
                        ))}
                    </ul>
                ) : null}
                <footer className="agent-panel__foot">
                    {total > queue.tasks.length ? (
                        <a href={route("tasks.index")}>
                            {t("pages.agent_workspace.today.queue.shown_of", { shown: queue.tasks.length, total })}
                        </a>
                    ) : null}
                    {leads + deals > 0 ? <span>{uncoveredText(t, leads, deals)}</span> : null}
                </footer>
            </section>
        </>
    );
}

/** "2 leads and 1 deal have no next step", leaving out a zero side. */
function uncoveredText(t: (key: string, params?: Record<string, string | number>) => string, leads: number, deals: number): string {
    const key = "pages.agent_workspace.today.queue";
    const part = (kind: "leads" | "deals", count: number) =>
        count === 1 ? t(`${key}.uncovered_${kind}_one`) : t(`${key}.uncovered_${kind}_many`, { count });
    const parts = [leads > 0 ? part("leads", leads) : null, deals > 0 ? part("deals", deals) : null].filter(
        (item): item is string => item !== null,
    );
    const items = parts.length === 2 ? t(`${key}.uncovered_join`, { first: parts[0], second: parts[1] }) : parts[0];
    return t(`${key}.${leads + deals === 1 ? "uncovered_one" : "uncovered_many"}`, { items });
}

export function TaskQueueSkeleton() {
    return (
        <div aria-busy="true" className="agent-skeleton-stack">
            <div className="dr-skeleton" style={{ height: 112, borderRadius: 18 }} />
            <div className="agent-panel">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="dr-skeleton" style={{ height: 56, borderRadius: 12, marginTop: index ? 8 : 0 }} />
                ))}
            </div>
        </div>
    );
}
