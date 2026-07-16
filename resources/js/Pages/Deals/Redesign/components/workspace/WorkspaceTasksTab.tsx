import { useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { isCompletedColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { taskApi } from "@/lib/api/tasks";
import type { Task } from "@/Types/api/tasks";
import {
    toWorkspaceTaskListItem,
    type WorkspaceTaskListItem,
} from "../../adapters/taskAdapter";
import DealAvatar from "../primitives/DealAvatar";
import DealBulkActionBar from "../primitives/DealBulkActionBar";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import DealMenuSelect from "../primitives/DealMenuSelect";
import DealSelectCheckbox from "../primitives/DealSelectCheckbox";
import OverviewPriorityBadge from "./overview/OverviewPriorityBadge";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

type TaskFilter = "open" | "done" | "all";

interface WorkspaceTasksTabProps {
    tasks: Task[];
    taskBoardColumns: TaskboardColumn[];
    permissions: Record<string, string>;
    onAddTask: () => void;
}

function canAddTasks(permissions: Record<string, string>): boolean {
    const permission = permissions.add_tasks;
    return (
        permission === "all" ||
        permission === "added" ||
        permission === "both"
    );
}

function taskStatusSlug(task: Task): string {
    return (
        (task as Task & { board_column?: { slug?: string } }).board_column
            ?.slug ||
        task.status ||
        "to_do"
    );
}

function isTaskDone(
    task: Task,
    taskBoardColumns: TaskboardColumn[],
): boolean {
    const status = taskStatusSlug(task);
    return (
        isCompletedColumn(status, taskBoardColumns) || Boolean(task.completed_on)
    );
}

function filterTasks(
    items: WorkspaceTaskListItem[],
    rawTasks: Task[],
    taskBoardColumns: TaskboardColumn[],
    filter: TaskFilter,
): WorkspaceTaskListItem[] {
    return items.filter((item) => {
        const rawTask = rawTasks.find((task) => task.id === item.id);
        if (!rawTask) return filter === "all";

        const done = isTaskDone(rawTask, taskBoardColumns);
        if (filter === "open") return !done;
        if (filter === "done") return done;
        return true;
    });
}

export default function WorkspaceTasksTab({
    tasks,
    taskBoardColumns,
    permissions,
    onAddTask,
}: WorkspaceTasksTabProps) {
    const { td } = useTd();
    const [filter, setFilter] = useState<TaskFilter>("open");
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();

    const taskItems = useMemo(
        () => tasks.map((task) => toWorkspaceTaskListItem(task)),
        [tasks],
    );

    const filteredTasks = useMemo(
        () => filterTasks(taskItems, tasks, taskBoardColumns, filter),
        [filter, taskBoardColumns, taskItems, tasks],
    );

    const showAddTask = canAddTasks(permissions);

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelected(new Set());
    };

    const toggleSelect = (taskId: number) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const allSelected =
        filteredTasks.length > 0 &&
        filteredTasks.every((task) => selected.has(task.id));
    const toggleSelectAll = () =>
        setSelected(
            allSelected
                ? new Set()
                : new Set(filteredTasks.map((task) => task.id)),
        );

    const handleStatusChange = (taskId: number, slug: string) => {
        updateTaskStatus(
            { taskId, status: slug },
            { onSuccess: () => router.reload({ only: ["tasks"] }) },
        );
    };

    const handleBulkStatusChange = (slug: string) => {
        selected.forEach((taskId) => {
            updateTaskStatus({ taskId, status: slug });
        });
        router.reload({ only: ["tasks"] });
        exitSelectMode();
    };

    return (
        <div>
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <div className="flex gap-1">
                    {(["open", "done", "all"] as const).map((option) => {
                        const active = filter === option;

                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setFilter(option)}
                                className="rounded-md border px-2.5 py-1 text-[11px] capitalize transition-colors"
                                style={{
                                    background: active ? T.NAVY : "transparent",
                                    color: active ? T.WHITE : T.TEXT_MUTED,
                                    borderColor: active ? T.NAVY : T.BORDER,
                                }}
                            >
                                {td(option)}
                            </button>
                        );
                    })}
                </div>

                <div className="flex gap-1.5">
                    <DealButton
                        variant="ghost"
                        onClick={() =>
                            selectMode ? exitSelectMode() : setSelectMode(true)
                        }
                    >
                        {selectMode ? td("Cancel") : td("Select")}
                    </DealButton>
                    {showAddTask && (
                        <DealButton variant="navy" onClick={onAddTask}>
                            + {td("Add task")}
                        </DealButton>
                    )}
                </div>
            </div>

            {selectMode && (
                <DealBulkActionBar
                    count={selected.size}
                    onClear={() => setSelected(new Set())}
                    clearLabel={td("Clear")}
                >
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.WHITE, color: T.NAVY }}
                        onClick={toggleSelectAll}
                    >
                        {allSelected ? td("Deselect all") : td("Select all")}
                    </button>
                    <DealMenuSelect
                        value={null}
                        placeholder={td("Set status…")}
                        size="sm"
                        disabled={!selected.size}
                        width={140}
                        triggerClassName="dr-btn dr-btn-sm"
                        triggerStyle={{ background: T.WHITE, color: T.NAVY, border: "none" }}
                        options={taskBoardColumns
                            .slice()
                            .sort((a, b) => a.priority - b.priority)
                            .map((column) => ({
                                value: column.slug,
                                label: td(column.column_name),
                            }))}
                        onChange={(value) => handleBulkStatusChange(String(value))}
                    />
                </DealBulkActionBar>
            )}

            {filteredTasks.length === 0 ? (
                <div className="rounded-lg border border-[#e2e5ea] bg-white px-5 py-9 text-center">
                    <DealIcon
                        name="check-square"
                        size={28}
                        color={T.TEXT_HINT}
                        className="mx-auto mb-2 opacity-50"
                    />
                    <p className="mb-3 text-[13px] text-[#5b6472]">
                        {td("No")} {filter} {td("tasks")}
                    </p>
                    {showAddTask && (
                        <DealButton variant="navy" onClick={onAddTask}>
                            + {td("Add task")}
                        </DealButton>
                    )}
                </div>
            ) : (
                filteredTasks.map((task) => {
                    const rawTask = tasks.find((item) => item.id === task.id);
                    const done = rawTask
                        ? isTaskDone(rawTask, taskBoardColumns)
                        : !task.isOpen;
                    const statusSlug = rawTask ? taskStatusSlug(rawTask) : "to_do";

                    return (
                        <article
                            key={task.id}
                            className="mb-2 flex items-start gap-3 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3 last:mb-0"
                            style={{ opacity: done ? 0.65 : 1 }}
                        >
                            {selectMode && (
                                <div className="pt-0.5">
                                    <DealSelectCheckbox
                                        checked={selected.has(task.id)}
                                        onChange={() => toggleSelect(task.id)}
                                        label={`Select task ${task.title}`}
                                    />
                                </div>
                            )}

                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span
                                        className="text-[13px] font-medium text-[#1a1f2e]"
                                        style={{
                                            textDecoration: done
                                                ? "line-through"
                                                : "none",
                                        }}
                                    >
                                        {task.title}
                                    </span>
                                    <OverviewPriorityBadge
                                        priority={task.priority}
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#5b6472]">
                                    <span className="inline-flex items-center gap-1">
                                        <DealIcon name="calendar" size={11} />
                                        {task.dueDateLabel}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <DealAvatar
                                            size={18}
                                            initials={task.assigneeInitials}
                                        />
                                        {task.assigneeName}
                                    </span>
                                </div>
                            </div>

                            <TaskStatusDropdownPill
                                status={statusSlug}
                                columns={taskBoardColumns}
                                disabled={selectMode}
                                onChange={(slug) =>
                                    handleStatusChange(task.id, slug)
                                }
                            />
                        </article>
                    );
                })
            )}
        </div>
    );
}
