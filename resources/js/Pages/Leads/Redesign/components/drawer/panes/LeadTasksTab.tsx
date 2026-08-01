import { useMemo, useState } from "react";
import { Spin } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { isCompletedColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { taskApi } from "@/lib/api/tasks";
import type { Task } from "@/Types/api/tasks";
import {
    toWorkspaceTaskListItem,
    type WorkspaceTaskListItem,
} from "@/Pages/Deals/Redesign/adapters/taskAdapter";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import OverviewPriorityBadge from "@/Pages/Deals/Redesign/components/workspace/overview/OverviewPriorityBadge";
import TaskEntityLink from "@/Features/Tasks/Components/TaskEntityLink";
import { LEAD_REDESIGN_TOKENS as T } from "../../../types";

type TaskFilter = "open" | "done" | "all";

interface LeadTasksTabProps {
    tasks: Task[];
    taskBoardColumns: TaskboardColumn[];
    permissions: Record<string, string>;
    onAddTask: () => void;
    isLoading?: boolean;
    onTaskStatusChange?: (
        taskId: number,
        statusSlug: string,
        rollbackTask?: Task,
    ) => void;
}

function canAddTasks(permissions: Record<string, string>): boolean {
    const permission = permissions?.add_tasks;
    return (
        permission === "all" || permission === "added" || permission === "both"
    );
}

function isTaskDone(task: Task, taskBoardColumns: TaskboardColumn[]): boolean {
    const status =
        (task as Task & { board_column?: { slug?: string } }).board_column
            ?.slug ||
        task.status ||
        "to_do";

    return (
        isCompletedColumn(status, taskBoardColumns) ||
        Boolean(task.completed_on)
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

export default function LeadTasksTab({
    tasks,
    taskBoardColumns,
    permissions,
    onAddTask,
    isLoading = false,
    onTaskStatusChange,
}: LeadTasksTabProps) {
    const { td } = useTd();
    const [filter, setFilter] = useState<TaskFilter>("open");
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

    const handleToggleTask = (
        taskId: number,
        event: React.MouseEvent<HTMLButtonElement>,
    ) => {
        event.stopPropagation();

        const rawTask = tasks.find((task) => task.id === taskId);
        if (!rawTask) return;

        const currentStatus =
            (rawTask as Task & { board_column?: { slug?: string } })
                .board_column?.slug ||
            rawTask.status ||
            "to_do";
        const isDone = isCompletedColumn(currentStatus, taskBoardColumns);
        const nextStatus = isDone ? "to_do" : "done";
        const originalTask = { ...rawTask };

        onTaskStatusChange?.(taskId, nextStatus);
        updateTaskStatus(
            { taskId, status: nextStatus },
            {
                onError: () => {
                    onTaskStatusChange?.(
                        taskId,
                        currentStatus,
                        originalTask,
                    );
                },
            },
        );
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

                {showAddTask && (
                    <Button variant="navy" onClick={onAddTask}>
                        + {td("Add task")}
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Spin />
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="rounded-lg border border-[#e2e5ea] bg-white px-5 py-9 text-center">
                    <Icon
                        name="check-square"
                        size={28}
                        color={T.TEXT_HINT}
                        className="mx-auto mb-2 opacity-50"
                    />
                    <p className="mb-3 text-[13px] text-[#9ca3af]">
                        {td("No")} {filter} {td("tasks")}
                    </p>
                    {showAddTask && (
                        <Button variant="navy" onClick={onAddTask}>
                            + {td("Add task")}
                        </Button>
                    )}
                </div>
            ) : (
                filteredTasks.map((task) => {
                    const rawTask = tasks.find((item) => item.id === task.id);
                    const done = rawTask
                        ? isTaskDone(rawTask, taskBoardColumns)
                        : !task.isOpen;

                    return (
                        <article
                            key={task.id}
                            className="mb-2 flex items-start gap-3 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3 last:mb-0"
                            style={{ opacity: done ? 0.65 : 1 }}
                        >
                            <button
                                type="button"
                                className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border-2 text-[11px] font-semibold text-white"
                                style={{
                                    borderColor: done ? T.GREEN : T.BORDER,
                                    background: done ? T.GREEN : T.WHITE,
                                }}
                                onClick={(event) =>
                                    handleToggleTask(task.id, event)
                                }
                            >
                                {done ? "✓" : ""}
                            </button>

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

                                <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-[#9ca3af]">
                                    <span className="inline-flex items-center gap-1">
                                        <Icon name="calendar" size={11} />
                                        {task.dueDateLabel}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Avatar
                                            size={18}
                                            initials={task.assigneeInitials}
                                        />
                                        {task.assigneeName}
                                    </span>
                                </div>

                                {rawTask?.deals && rawTask.deals.length > 0 && (
                                    <TaskEntityLink
                                        type="deal"
                                        id={rawTask.deals[0].id}
                                        name={rawTask.deals[0].name}
                                        className="mt-1"
                                    />
                                )}
                            </div>
                        </article>
                    );
                })
            )}
        </div>
    );
}
