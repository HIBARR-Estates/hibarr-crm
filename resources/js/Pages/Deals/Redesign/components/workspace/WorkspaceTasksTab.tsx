import { useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { isCompletedColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Task } from "@/Types/api/tasks";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealTaskStatus from "../../hooks/useDealTaskStatus";
import DealTaskDetailModal from "./DealTaskDetailModal";
import {
    toWorkspaceTaskListItem,
    type WorkspaceTaskListItem,
} from "../../adapters/taskAdapter";
import DealAvatar from "../primitives/DealAvatar";
import DealBulkActionBar from "../primitives/DealBulkActionBar";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import DealMenuSelect from "../primitives/DealMenuSelect";
import DealSelectCheckbox from "../primitives/DealSelectCheckbox";
import DealPriorityBadge from "../primitives/DealPriorityBadge";
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

/** v2.2 AssigneeStack (deal-v2-2.jsx:1849-1871) — overlapping avatars, +N cap. */
function AssigneeStack({
    people,
    size = 18,
    max = 3,
}: {
    people: Array<{ id: number; name: string; initials: string }>;
    size?: number;
    max?: number;
}) {
    if (!people.length) return null;
    const shown = people.slice(0, max);
    const overflow = people.length - shown.length;
    return (
        <span
            className="inline-flex items-center"
            title={people.map((person) => person.name).join(", ")}
        >
            {shown.map((person, index) => (
                <span
                    key={person.id}
                    className="flex rounded-full"
                    style={{
                        marginLeft: index === 0 ? 0 : -6,
                        border: `2px solid ${T.WHITE}`,
                    }}
                >
                    <DealAvatar size={size} initials={person.initials} />
                </span>
            ))}
            {overflow > 0 && (
                <span
                    className="flex shrink-0 items-center justify-center rounded-full font-bold"
                    style={{
                        marginLeft: -6,
                        width: size,
                        height: size,
                        border: `2px solid ${T.WHITE}`,
                        background: T.BORDER,
                        color: T.TEXT_MUTED,
                        fontSize: Math.max(9, size * 0.4),
                    }}
                >
                    +{overflow}
                </span>
            )}
        </span>
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
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const { setStatus, isPending } = useDealTaskStatus();
    const { setTasks } = useDealWorkspace();
    const selectedTask =
        tasks.find((task) => task.id === selectedTaskId) ?? null;

    // Single bulk endpoint backing both actions below — mirrors the legacy
    // BulkChangeTaskStatus/BulkDeleteTasks components (Features/Tasks/BulkActions).
    // Looping the single-task status mutation per selected id (the previous
    // approach) fired N concurrent requests through one shared mutation
    // observer, which is why only some rows ever reflected the new status.
    const { mutate: applyBulkAction, status: bulkActionStatus } = useApiMutate<
        { row_ids: string; action_type: string; status?: number },
        unknown,
        ApiResponse<unknown>
    >("/account/tasks/apply-quick-action", "POST");
    const isBulkActing = isLoading({ status: bulkActionStatus });

    const taskItems = useMemo(
        () => tasks.map((task) => toWorkspaceTaskListItem(task)),
        [tasks],
    );

    const filteredTasks = useMemo(
        () => filterTasks(taskItems, tasks, taskBoardColumns, filter),
        [filter, taskBoardColumns, taskItems, tasks],
    );

    const showAddTask = canAddTasks(permissions);
    // Backend hard-requires the full delete_tasks scope for bulk delete
    // (TaskController::deleteRecords aborts otherwise) — only show it when
    // we know it's allowed rather than exposing a button the API will reject.
    const canBulkDelete = permissions.delete_tasks === "all";

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

    const handleBulkStatusChange = (columnId: number) => {
        const column = taskBoardColumns.find((c) => c.id === columnId);
        if (!column) return;
        const ids = Array.from(selected);
        applyBulkAction(
            { row_ids: ids.join(","), action_type: "change-status", status: columnId },
            {
                onSuccess: () => {
                    setTasks((prev) =>
                        prev.map((task) =>
                            ids.includes(task.id)
                                ? ({
                                      ...task,
                                      status: column.slug,
                                      board_column: column,
                                      // Mirror TaskController::changeBulkStatus
                                      // (server-side fix below): completed_on
                                      // only survives when the target is "done".
                                      completed_on:
                                          column.slug === "done"
                                              ? new Date()
                                                    .toISOString()
                                                    .slice(0, 10)
                                              : undefined,
                                  } as Task)
                                : task,
                        ),
                    );
                    exitSelectMode();
                },
            },
        );
    };

    const handleBulkDelete = () => {
        const ids = Array.from(selected);
        applyBulkAction(
            { row_ids: ids.join(","), action_type: "delete" },
            {
                onSuccess: () => {
                    setTasks((prev) =>
                        prev.filter((task) => !ids.includes(task.id)),
                    );
                    setConfirmBulkDelete(false);
                    exitSelectMode();
                },
            },
        );
    };

    return (
        <div>
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <div
                    className="flex gap-1"
                    role="group"
                    aria-label="Filter tasks"
                >
                    {(["open", "done", "all"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            className="dr-filter"
                            aria-pressed={filter === option}
                            onClick={() => setFilter(option)}
                        >
                            {td(option)}
                        </button>
                    ))}
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
                        <DealButton variant="primary" size="sm" onClick={onAddTask}>
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
                        disabled={!selected.size || isBulkActing}
                        width={140}
                        triggerClassName="dr-btn dr-btn-sm"
                        triggerStyle={{ background: T.WHITE, color: T.NAVY, border: "none" }}
                        options={taskBoardColumns
                            .slice()
                            .sort((a, b) => a.priority - b.priority)
                            .map((column) => ({
                                value: column.id,
                                label: td(column.column_name),
                            }))}
                        onChange={(value) => handleBulkStatusChange(Number(value))}
                    />
                    {canBulkDelete && (
                        <button
                            type="button"
                            className="dr-btn dr-btn-sm"
                            style={{ background: T.RED, color: T.WHITE }}
                            disabled={!selected.size || isBulkActing}
                            onClick={() => setConfirmBulkDelete(true)}
                        >
                            {td("Delete")}
                        </button>
                    )}
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
                        <DealButton variant="primary" size="sm" onClick={onAddTask}>
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
                    const overdue =
                        !done &&
                        task.dueDate != null &&
                        task.dueDate.getTime() < Date.now();

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

                            <button
                                type="button"
                                onClick={() =>
                                    selectMode
                                        ? toggleSelect(task.id)
                                        : setSelectedTaskId(task.id)
                                }
                                aria-label={
                                    selectMode
                                        ? `Select task ${task.title}`
                                        : `Open task — ${task.title}`
                                }
                                className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                            >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                    <span
                                        className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1a1f2e]"
                                        style={{
                                            textDecoration: done
                                                ? "line-through"
                                                : "none",
                                        }}
                                    >
                                        {task.title}
                                    </span>
                                    <DealPriorityBadge
                                        priority={task.priority}
                                    />
                                </div>
                                {task.descriptionText && (
                                    <div
                                        className="mb-1.5 text-xs leading-normal"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        {task.descriptionText}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#5b6472]">
                                    <span
                                        className="inline-flex items-center gap-1"
                                        style={{
                                            color: overdue
                                                ? T.RED
                                                : T.TEXT_MUTED,
                                            fontWeight: overdue ? 600 : 400,
                                        }}
                                    >
                                        <DealIcon name="calendar" size={11} />
                                        {task.dueDateLabel}
                                        {overdue && ` · ${td("Overdue")}`}
                                    </span>
                                    {task.assignees.length > 0 && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <AssigneeStack
                                                people={task.assignees}
                                            />
                                            {task.assignees.length === 1
                                                ? task.assignees[0].name
                                                : `${task.assignees.length} ${td("assignees")}`}
                                        </span>
                                    )}
                                </div>
                            </button>

                            <TaskStatusDropdownPill
                                status={statusSlug}
                                columns={taskBoardColumns}
                                disabled={selectMode}
                                loading={isPending(task.id)}
                                onChange={(slug) => setStatus(task.id, slug)}
                            />
                        </article>
                    );
                })
            )}

            <DealTaskDetailModal
                task={selectedTask}
                taskBoardColumns={taskBoardColumns}
                onClose={() => setSelectedTaskId(null)}
            />

            <DealConfirmDialog
                open={confirmBulkDelete}
                title={`${td("Delete")} ${selected.size} ${
                    selected.size === 1 ? td("task") : td("tasks")
                }?`}
                message={td(
                    "These tasks will be permanently removed from the deal. This cannot be undone.",
                )}
                confirmLabel={td("Delete tasks")}
                danger
                confirmLoading={isBulkActing}
                onConfirm={handleBulkDelete}
                onCancel={() => setConfirmBulkDelete(false)}
            />
        </div>
    );
}
