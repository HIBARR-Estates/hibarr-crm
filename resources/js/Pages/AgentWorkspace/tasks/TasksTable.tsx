import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import TaskRow, { type TaskRowHandlers } from "./TaskRow";
import type { TaskView } from "./format";

const COLUMNS = ["task", "linked", "priority", "due", "assignee"] as const;

export function TasksTableSkeleton() {
    return (
        <div className="agent-tk__table" aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="agent-tk__skeleton-row">
                    <span className="agent-tk__skeleton-bar" style={{ width: "70%" }} />
                    <span className="agent-tk__skeleton-bar" style={{ width: "55%" }} />
                    <span className="agent-tk__skeleton-bar" style={{ width: "40%" }} />
                    <span className="agent-tk__skeleton-bar" style={{ width: "60%" }} />
                    <span className="agent-tk__skeleton-bar" style={{ width: "50%" }} />
                </div>
            ))}
        </div>
    );
}

/** The list in due order: no date last. */
export default function TasksTable({ views, handlers }: { views: TaskView[]; handlers: TaskRowHandlers }) {
    const { t } = useTranslation();

    if (views.length === 0) {
        return (
            <div className="agent-tk__table">
                <EmptyState
                    icon="check-square"
                    title={t("pages.agent_workspace.tasks.empty_title")}
                    description={t("pages.agent_workspace.tasks.empty_description")}
                />
            </div>
        );
    }

    return (
        <div className="agent-tk__table" role="table" aria-label={t("pages.agent_workspace.tasks.title")}>
            <div role="row" className="agent-tk__head">
                {COLUMNS.map((column) => (
                    <span key={column} role="columnheader" className="agent-tk__th" aria-sort={column === "due" ? "ascending" : undefined}>
                        {t(`pages.agent_workspace.tasks.cols.${column}`)}
                        {column === "due" ? " ↑" : ""}
                    </span>
                ))}
                <span aria-hidden="true" />
                <span aria-hidden="true" />
            </div>
            {views.map((view) => (
                <TaskRow key={view.task.id} view={view} handlers={handlers} />
            ))}
        </div>
    );
}
