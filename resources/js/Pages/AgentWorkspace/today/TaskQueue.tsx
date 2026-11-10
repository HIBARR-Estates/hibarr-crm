import { Link } from "@inertiajs/react";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { AgentCallButton, taskTimeState, type TimeState } from "@/Components/Redesign/agent";
import { useTd } from "@/Hooks/useDynamicTranslation";
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

/** "Lead · Qualifying" / "Deal · Schedule Appointment": where the record stands. */
export function RecordBadge({ record }: { record: RelatedRecord }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const kind = record.type === "lead" ? t("pages.agent_workspace.today.record.lead") : t("pages.agent_workspace.today.record.deal");
    return (
        <span className={`agent-badge agent-badge--${record.type}`}>
            {record.type === "deal" ? <span className="agent-badge__mark" aria-hidden="true" /> : null}
            {record.status ? `${kind} · ${td(record.status, { source: "en" })}` : kind}
        </span>
    );
}

/** Who a task is about: the person, else the record, else nobody. */
function personOf(task: QueueTask): string {
    return task.related?.person || task.related?.name || "";
}

/**
 * "Do this first": the first open task in due-date order, as the board's
 * hero card. With a person behind it, the actions are to call them and to
 * open their page; without one, Done and Reschedule.
 */
export function NextUpCard({ task, handlers }: { task: QueueTask; handlers: TaskHandlers }) {
    const { t, done, state, due } = useTaskView(task, handlers);
    const person = personOf(task);
    const related = task.related;

    return (
        <section className={`agent-next agent-ts--${state}`} aria-labelledby="agent-next-title">
            <p className="agent-next__strip">
                <span className="agent-next__dot" aria-hidden="true" />
                {t("pages.agent_workspace.today.next.label")} · {due}
            </p>
            <div className="agent-next__main">
                <Avatar initials={initialsFromName(person || task.heading)} size={60} type="agent" />
                <div className="agent-next__body">
                    <button type="button" id="agent-next-title" className="agent-next__title" onClick={() => handlers.onOpen(task)}>
                        {person ? `${person} · ${task.heading}` : task.heading}
                    </button>
                    <div className="agent-next__meta">
                        {related ? <RecordBadge record={related} /> : null}
                        {related && related.person && related.type === "deal" ? <span>{related.name}</span> : null}
                    </div>
                </div>
                <div className="agent-next__actions">
                    {related ? (
                        <>
                            <AgentCallButton
                                phone={related.phone ?? ""}
                                entity={{ type: related.type, id: related.id }}
                                label={t("pages.agent_workspace.today.next.call_name", { name: (person.split(" ")[0] || person) })}
                            />
                            <Link href={recordHref(related)} className="dr-btn dr-btn-ghost">
                                {t("pages.agent_workspace.today.next.open_contact")}
                            </Link>
                        </>
                    ) : (
                        <TaskActions
                            name={task.heading}
                            done={done}
                            emphasis
                            completing={handlers.isCompleting(task.id)}
                            rescheduling={handlers.isRescheduling(task.id)}
                            onComplete={() => handlers.onComplete(task)}
                            onReschedule={() => handlers.onReschedule(task)}
                        />
                    )}
                </div>
            </div>
        </section>
    );
}

/** One row of the queue: the person, where they stand, the task and when it is due. */
function QueueRow({ task, handlers }: { task: QueueTask; handlers: TaskHandlers }) {
    const { t, done, state, due } = useTaskView(task, handlers);
    const person = personOf(task);
    const related = task.related;

    return (
        <li className={`agent-q__row agent-ts--${state}${done ? " is-done" : ""}`}>
            <Avatar initials={initialsFromName(person || task.heading)} size={36} />
            <div className="agent-q__body">
                <div className="agent-q__head">
                    {related ? (
                        <Link href={recordHref(related)} className="agent-q__name">
                            {person}
                        </Link>
                    ) : null}
                    {related ? <RecordBadge record={related} /> : null}
                </div>
                <button type="button" className="agent-q__title" onClick={() => handlers.onOpen(task)}>
                    {task.heading}
                    {related?.type === "deal" && related.person ? <span className="agent-q__deal"> · {related.name}</span> : null}
                </button>
            </div>
            <span className="agent-q__due">
                <span className="agent-q__due-dot" aria-hidden="true" />
                {due}
            </span>
            {related ? (
                <Link href={recordHref(related)} className="agent-q__open" aria-label={t("pages.agent_workspace.today.next.open_contact")}>
                    <Icon name="chevron-right" size={16} />
                </Link>
            ) : (
                <button type="button" className="agent-q__open" onClick={() => handlers.onOpen(task)} aria-label={task.heading}>
                    <Icon name="chevron-right" size={16} />
                </button>
            )}
        </li>
    );
}

/**
 * My work: the queue in its own due-date order. The first open task is lifted
 * into the "Do this first" card; the rest follow as rows about their people.
 * Counts come from the server's totals, which are not capped like the rows are.
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
            {rest.length > 0 ? (
                <section className="agent-panel" aria-labelledby="agent-queue-title">
                    <header className="agent-panel__head">
                        <h2 id="agent-queue-title" className="agent-panel__title">
                            {t("pages.agent_workspace.today.queue.title")}
                            <span className="agent-panel__title-sub">
                                {" · "}
                                {t("pages.agent_workspace.today.queue.counts", {
                                    overdue: queue.counts.overdue,
                                    today: queue.counts.today,
                                    later: queue.counts.later,
                                })}
                            </span>
                        </h2>
                    </header>
                    <ul className="agent-q">
                        {rest.map((task) => (
                            <QueueRow key={task.id} task={task} handlers={handlers} />
                        ))}
                    </ul>
                    <footer className="agent-panel__foot">
                        {total > queue.tasks.length ? (
                            <a className="dr-btn dr-btn-sm agent-show-all" href={route("tasks.index")}>
                                <Icon name="chevron-down" size={13} />
                                {t("pages.agent_workspace.today.queue.show_all", { count: total })}
                            </a>
                        ) : null}
                        {leads + deals > 0 ? <span>{uncoveredText(t, leads, deals)}</span> : null}
                    </footer>
                </section>
            ) : null}
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
            <div className="dr-skeleton" style={{ height: 156, borderRadius: 20 }} />
            <div className="agent-panel">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="dr-skeleton" style={{ height: 56, borderRadius: 12, marginTop: index ? 8 : 0 }} />
                ))}
            </div>
        </div>
    );
}
