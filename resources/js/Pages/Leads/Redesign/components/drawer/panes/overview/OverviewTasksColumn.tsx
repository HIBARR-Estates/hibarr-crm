import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    isCompletedColumn,
    type TaskboardColumn,
} from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/api/tasks";
import { taskApi } from "@/lib/api/tasks";
import DealIcon from "@/Pages/Deals/Redesign/components/primitives/DealIcon";
import OverviewPriorityBadge from "@/Pages/Deals/Redesign/components/workspace/overview/OverviewPriorityBadge";
import type { LeadTaskPreview } from "../../../../adapters/taskAdapter";
import { LEAD_REDESIGN_TOKENS as T } from "../../../../types";
import {
    OverviewColumnHeader,
    OverviewColumnShell,
    OverviewEmptyMini,
    OverviewViewLink,
} from "./overviewShared";

interface OverviewTasksColumnProps {
    tasks: LeadTaskPreview[];
    rawTasks: Task[];
    taskBoardColumns: TaskboardColumn[];
    openCount: number;
    canAdd?: boolean;
    isLoading?: boolean;
    onAddTask: () => void;
    onViewTask: () => void;
    onTaskStatusChange?: (taskId: number, statusSlug: string) => void;
}

export default function OverviewTasksColumn({
    tasks,
    rawTasks,
    taskBoardColumns,
    openCount,
    canAdd = true,
    isLoading = false,
    onAddTask,
    onViewTask,
    onTaskStatusChange,
}: OverviewTasksColumnProps) {
    const { td } = useTd();
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();

    const handleToggleTask = (taskId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        const rawTask = rawTasks.find((task) => task.id === taskId);
        if (!rawTask) return;

        const currentStatus =
            (rawTask as { board_column?: { slug?: string } }).board_column
                ?.slug ||
            rawTask.status ||
            "to_do";
        const isDone = isCompletedColumn(currentStatus, taskBoardColumns);
        const nextStatus = isDone ? "to_do" : "done";

        onTaskStatusChange?.(taskId, nextStatus);
        updateTaskStatus(
            { taskId, status: nextStatus },
            {
                onError: () => {
                    onTaskStatusChange?.(taskId, currentStatus);
                },
            },
        );
    };

    return (
        <OverviewColumnShell borderSide="middle">
            <OverviewColumnHeader
                icon="check-square"
                iconBg={T.GREEN_LIGHT}
                iconColor={T.GREEN}
                title={td("Tasks")}
                count={isLoading ? 0 : openCount}
                onAdd={canAdd ? onAddTask : undefined}
            />
            <div className="max-h-[560px] overflow-y-auto pr-0.5">
                {isLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-16 animate-pulse rounded-lg border border-[#e2e5ea] bg-[#f8fafc]"
                            />
                        ))}
                    </div>
                ) : tasks.length === 0 ? (
                    <OverviewEmptyMini
                        icon="check-square"
                        label={td("No tasks yet")}
                    />
                ) : (
                    tasks.map((task) => {
                        const rawTask = rawTasks.find(
                            (item) => item.id === task.id,
                        );
                        const status =
                            (
                                rawTask as
                                    | { board_column?: { slug?: string } }
                                    | undefined
                            )?.board_column?.slug ||
                            rawTask?.status ||
                            "to_do";
                        const isDone =
                            !task.isOpen ||
                            isCompletedColumn(status, taskBoardColumns);
                        const expanded = expandedId === task.id;

                        return (
                            <article
                                key={task.id}
                                className="mb-2 cursor-pointer rounded-lg border border-[#e2e5ea] bg-white px-3 py-2.5"
                                style={{ opacity: isDone ? 0.65 : 1 }}
                                onClick={() =>
                                    setExpandedId(expanded ? null : task.id)
                                }
                            >
                                <div className="flex items-start gap-2.5">
                                    <div className="flex shrink-0 flex-col items-center gap-1.5">
                                        <button
                                            type="button"
                                            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 text-[10px] font-semibold text-white"
                                            style={{
                                                borderColor: isDone
                                                    ? T.GREEN
                                                    : T.BORDER,
                                                background: isDone
                                                    ? T.GREEN
                                                    : T.WHITE,
                                            }}
                                            onClick={(event) =>
                                                handleToggleTask(task.id, event)
                                            }
                                        >
                                            {isDone ? "✓" : ""}
                                        </button>
                                        <OverviewPriorityBadge
                                            priority={task.priority}
                                            vertical
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1">
                                            <span
                                                className="text-xs font-medium text-[#1a1f2e]"
                                                style={{
                                                    textDecoration: isDone
                                                        ? "line-through"
                                                        : "none",
                                                }}
                                            >
                                                {task.title}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-[#9ca3af]">
                                            <DealIcon name="calendar" size={11} />
                                            {task.dueDateLabel}
                                        </div>
                                        {expanded && (
                                            <div className="mt-1.5 border-t border-[#e2e5ea] pt-1.5 text-[11px] leading-relaxed text-[#6b7280]">
                                                {task.description ||
                                                    td("No description.")}
                                            </div>
                                        )}
                                        <div className="mt-1.5 text-right">
                                            <OverviewViewLink
                                                label={td("View task ↗")}
                                                onClick={onViewTask}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </OverviewColumnShell>
    );
}
