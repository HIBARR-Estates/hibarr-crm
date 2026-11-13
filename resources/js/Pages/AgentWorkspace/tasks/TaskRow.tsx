import { memo } from "react";
import { Link } from "@inertiajs/react";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { QueueTask, RelatedRecord } from "@/Types/personal-work";
import { recordHref } from "../today/TaskQueue";
import { dueText, type TaskView } from "./format";

export interface TaskRowHandlers {
    nowMs: number;
    timeZone: string;
    userId: number;
    onOpen: (task: QueueTask) => void;
    onComplete: (task: QueueTask) => void;
    onReschedule: (task: QueueTask) => void;
    isCompleting: (taskId: number) => boolean;
    isRescheduling: (taskId: number) => boolean;
}

const PRIORITY_CLASS: Record<string, string> = {
    low: "low",
    medium: "medium",
    high: "high",
    highest: "high",
    urgent: "high",
};

/** "Zimmermann · CC-Tower Iskele": the person's surname, then the deal. */
function linkedLine(related: RelatedRecord): string {
    if (related.type !== "deal" || !related.person) return related.name;
    const surname = related.person.trim().split(/\s+/).pop() ?? related.person;
    return related.name.toLowerCase().includes(surname.toLowerCase()) ? related.name : `${surname} · ${related.name}`;
}

function Linked({ task }: { task: QueueTask }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const related = task.related;

    if (related) {
        return (
            <>
                <Link
                    href={recordHref(related)}
                    className="agent-tk__linked-name"
                    aria-label={t("pages.agent_workspace.tasks.row.link_aria", { name: related.name })}
                >
                    {linkedLine(related)}
                </Link>
                {related.status ? (
                    related.type === "lead" ? (
                        <span className="agent-tk__status" style={{ ["--tag" as string]: related.status_color || undefined }}>
                            {td(related.status, { source: "en" })}
                        </span>
                    ) : (
                        <span className="agent-tk__stage">
                            <span className="agent-tk__stage-mark" style={{ ["--stage" as string]: related.status_color || undefined }} aria-hidden="true" />
                            {td(related.status, { source: "en" })}
                        </span>
                    )
                ) : null}
            </>
        );
    }

    const property = task.properties?.[0]?.title;
    const project = task.project?.project_name;
    return <span className="agent-tk__linked-name agent-tk__linked-name--plain">{property || project || t("pages.agent_workspace.tasks.row.standalone")}</span>;
}

/**
 * One task (L7-17): the tick, what it is, what it is linked to, its priority
 * and due time, who has it and the two row actions. The title opens the task
 * in its own modal; the linked name and the chevron open the person or deal.
 */
function TaskRow({ view, handlers }: { view: TaskView; handlers: TaskRowHandlers }) {
    const { t, locale } = useTranslation();
    const { task, state } = view;
    const related = task.related;
    const assignees = task.users ?? [];
    const first = assignees[0];
    const mine = assignees.some((user) => user.id === handlers.userId);
    const busy = handlers.isCompleting(task.id) || handlers.isRescheduling(task.id);
    const priority = PRIORITY_CLASS[task.priority] ?? "medium";

    return (
        <div role="row" className="agent-tk__row">
            <div role="cell" className="agent-tk__c--task">
                <button
                    type="button"
                    className="agent-tk__tick"
                    disabled={busy}
                    onClick={() => handlers.onComplete(task)}
                    aria-label={t("pages.agent_workspace.tasks.row.complete_aria", { name: task.heading })}
                >
                    <Icon name="check" size={12} />
                </button>
                <button
                    type="button"
                    className="agent-tk__title"
                    onClick={() => handlers.onOpen(task)}
                    aria-label={t("pages.agent_workspace.tasks.row.open_aria", { name: task.heading })}
                >
                    {task.heading}
                </button>
            </div>

            <div className="agent-tk__line">
                <div role="cell" className="agent-tk__c--linked">
                    <Linked task={task} />
                </div>

                <div role="cell" className="agent-tk__c--priority">
                    <span className={`agent-tk__priority agent-tk__priority--${priority}`}>
                        <span className="agent-tk__priority-dot" aria-hidden="true" />
                        {t(`pages.agent_workspace.tasks.priority.${task.priority in PRIORITY_CLASS ? task.priority : "medium"}`)}
                    </span>
                </div>

                <div role="cell" className="agent-tk__c--due">
                    <span className={`agent-tk__due agent-ts--${state}`}>
                        <span className="agent-tk__due-dot" aria-hidden="true" />
                        {dueText(task, state, handlers.nowMs, handlers.timeZone, locale, t)}
                    </span>
                </div>

                <div role="cell" className="agent-tk__c--assignee">
                    {first ? (
                        <span className="agent-tk__assignee">
                            <span className={`agent-tk__avatar${mine ? "" : " agent-tk__avatar--other"}`} aria-hidden="true">
                                {initialsFromName(first.name)}
                            </span>
                            <span className="agent-tk__assignee-text">
                                {mine ? t("pages.agent_workspace.tasks.row.you") : first.name}
                                {assignees.length > 1 ? <small>{t("pages.agent_workspace.tasks.row.more", { count: assignees.length - 1 })}</small> : null}
                                {!mine && task.added_by === handlers.userId ? <small>{t("pages.agent_workspace.tasks.row.assigned_by_you")}</small> : null}
                            </span>
                        </span>
                    ) : (
                        <span className="agent-tk__muted">{t("pages.agent_workspace.tasks.row.unassigned")}</span>
                    )}
                </div>

                <div role="cell" className="agent-tk__c--actions">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="agent-tk__action"
                        disabled={busy}
                        onClick={() => handlers.onReschedule(task)}
                        aria-label={t("pages.agent_workspace.tasks.row.reschedule_aria", { name: task.heading })}
                    >
                        {t("pages.agent_workspace.tasks.row.reschedule")}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="agent-tk__action"
                        onClick={() => handlers.onOpen(task)}
                        aria-label={t("pages.agent_workspace.tasks.row.log_aria", { name: task.heading })}
                    >
                        {t("pages.agent_workspace.tasks.row.log")}
                    </Button>
                </div>
            </div>

            {related ? (
                <Link href={recordHref(related)} className="agent-tk__chevron" tabIndex={-1} aria-hidden="true">
                    <Icon name="chevron-right" size={16} />
                </Link>
            ) : (
                <span className="agent-tk__chevron" aria-hidden="true">
                    <Icon name="chevron-right" size={16} />
                </span>
            )}
        </div>
    );
}

export default memo(TaskRow);
