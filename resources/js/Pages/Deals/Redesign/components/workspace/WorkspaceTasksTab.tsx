import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import { Drawer } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import TaskCategoryManager from "@/Pages/Settings/TaskCategoryManager";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { isCompletedColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Task } from "@/Types/api/tasks";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealTaskStatus from "../../hooks/useDealTaskStatus";
import useFloatingMenuPosition from "../../hooks/useFloatingMenuPosition";
import DealTaskDetailModal from "./DealTaskDetailModal";
import type { Task as RedesignedTask } from "@/Types/Task";
import useTasksWorkspaceRedesignFlag from "@/Hooks/useTasksWorkspaceRedesignFlag";
import useTasksWorkspaceMutations from "@/Pages/Tasks/Redesign/hooks/useTasksWorkspaceMutations";
import TaskRedesignDetailModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignDetailModal";
import TaskRedesignFormModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignFormModal";
import {
    formLinksPayload,
    type TaskFormValues,
} from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import { afterUpdateTaskFormSubmit } from "@/Pages/Tasks/Redesign/adapters/taskFormSubmitAdapter";
import useTaskExtras from "@/Pages/Tasks/Redesign/hooks/useTaskExtras";
import type { TaskPermissionSet } from "@/Pages/Tasks/Redesign/adapters/taskPermissions";
import {
    toWorkspaceTaskListItem,
    type WorkspaceTaskListItem,
} from "../../adapters/taskAdapter";
import DealBulkActionBar from "../primitives/DealBulkActionBar";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import IntegrationOriginBadge from "@/Components/Redesign/primitives/IntegrationOriginBadge";
import DealMenuSelect from "../primitives/DealMenuSelect";
import DealPeoplePicker, {
    type DealPersonOption,
} from "../primitives/DealPeoplePicker";
import DealSelectCheckbox from "../primitives/DealSelectCheckbox";
import DealPriorityBadge from "../primitives/DealPriorityBadge";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface TaskCategoryOption {
    id: number;
    category_name: string;
}

type TaskFilter = "open" | "done" | "all";

interface EmployeeRecord {
    id: number;
    name: string;
    designation_name?: string;
}

/** Searchable "reassign to…" popover for the bulk bar — same DealPeoplePicker
 * used by the task/meeting/team assignee fields, floated over the navy bar. */
function BulkReassignButton({
    people,
    disabled,
    onPick,
}: {
    people: DealPersonOption[];
    disabled: boolean;
    onPick: (userId: number) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, btnRef, {
        align: "left",
        maxHeight: 300,
    });

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (event: MouseEvent) => {
            const target = event.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div style={{ display: "inline-flex" }}>
            <button
                ref={btnRef}
                type="button"
                className="dr-btn dr-btn-sm"
                style={{ background: T.WHITE, color: T.NAVY }}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                {t("pages.deals.workspace.tasks.reassign_to")}
            </button>
            {open &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="dr-menu"
                        role="dialog"
                        aria-label={t("pages.deals.workspace.tasks.reassign_to")}
                        style={{ ...floatStyle, minWidth: 240, padding: 8 }}
                    >
                        <DealPeoplePicker
                            people={people}
                            autoFocus
                            onPick={(person) => {
                                setOpen(false);
                                onPick(person.id);
                            }}
                        />
                    </div>,
                    document.body,
                )}
        </div>
    );
}

interface WorkspaceTasksTabProps {
    tasks: Task[];
    taskBoardColumns: TaskboardColumn[];
    permissions: Record<string, string>;
    onAddTask: () => void;
}

function canAddTasks(
    permissions: Record<string, string>,
    isWatcherOnly: boolean,
): boolean {
    if (isWatcherOnly) return false;
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
    const { t } = useTranslation();
    const { props } = usePage();
    const employees = (props as { employees?: EmployeeRecord[] }).employees;
    const taskCategories =
        (props as { taskCategories?: TaskCategoryOption[] }).taskCategories ??
        [];
    const userId = props.auth?.user?.id;
    const isAdmin = useIsAdminRole();
    const canManageTaskCategories =
        isAdmin || permissions.view_task_category === "all";
    const [taskSettingsOpen, setTaskSettingsOpen] = useState(false);
    const [filter, setFilter] = useState<TaskFilter>("open");
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const { setStatus, isPending } = useDealTaskStatus();
    const { deal, setTasks } = useDealWorkspace();
    const { isWatcherOnly } = useDealPermissions(deal);
    const selectedTask =
        tasks.find((task) => task.id === selectedTaskId) ?? null;

    // Behind crm.tasks-workspace-redesign: opening a task shows the
    // redesigned detail popup instead of the older combined view/edit
    // modal, with a separate edit form — same pattern as Leads' TasksTab.
    // The backend's dealTasks() endpoint already serializes through
    // TaskPresenter behind this same flag (TaskController::dealTasks()).
    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const editingTask =
        tasks.find((task) => task.id === editingTaskId) ?? null;
    const setRedesignedTasks = (
        updater: (prev: RedesignedTask[]) => RedesignedTask[],
    ) =>
        setTasks(
            (prev) =>
                updater(
                    prev as unknown as RedesignedTask[],
                ) as unknown as typeof prev,
        );
    const {
        updateTask: updateRedesignedTask,
        isUpdating: isUpdatingRedesignedTask,
        updateErrors: updateRedesignedTaskErrors,
        clearUpdateErrors: clearUpdateRedesignedErrors,
    } = useTasksWorkspaceMutations(setRedesignedTasks, editingTaskId);
    const { persistExtras } = useTaskExtras();

    const employeeOptions: DealPersonOption[] = useMemo(
        () =>
            (employees ?? []).map((employee) => ({
                id: employee.id,
                name: employee.name,
                designation: employee.designation_name,
            })),
        [employees],
    );

    // Single bulk endpoint backing all actions below — mirrors the legacy
    // BulkChangeTaskStatus/BulkDeleteTasks components (Features/Tasks/BulkActions).
    // Looping the single-task status mutation per selected id (the previous
    // approach) fired N concurrent requests through one shared mutation
    // observer, which is why only some rows ever reflected the new status.
    const { mutate: applyBulkAction, status: bulkActionStatus } = useApiMutate<
        {
            row_ids: string;
            action_type: string;
            status?: number;
            user_id?: number[];
        },
        unknown,
        ApiResponse<unknown>
    >("/account/tasks/apply-quick-action", "POST");
    const isBulkActing = isLoading({ status: bulkActionStatus });

    // Backend requires the full edit_tasks scope for bulk reassign
    // (TaskController::changeBulkAssignee aborts otherwise) — only surface the
    // control when it's allowed and there are employees to assign.
    const canBulkReassign =
        !isWatcherOnly &&
        permissions.edit_tasks === "all" &&
        employeeOptions.length > 0;

    const taskItems = useMemo(
        () => tasks.map((task) => toWorkspaceTaskListItem(task)),
        [tasks],
    );

    const filteredTasks = useMemo(
        () => filterTasks(taskItems, tasks, taskBoardColumns, filter),
        [filter, taskBoardColumns, taskItems, tasks],
    );

    const filterLabels: Record<TaskFilter, string> = {
        open: t("pages.deals.workspace.tasks.filter_open"),
        done: t("pages.deals.workspace.tasks.filter_done"),
        all: t("pages.deals.workspace.tasks.filter_all"),
    };

    const showAddTask = canAddTasks(permissions, isWatcherOnly);
    // Backend hard-requires the full delete_tasks scope for bulk delete
    // (TaskController::deleteRecords aborts otherwise) — only show it when
    // we know it's allowed rather than exposing a button the API will reject.
    const canBulkDelete =
        !isWatcherOnly && permissions.delete_tasks === "all";
    const showSelectMode = !isWatcherOnly;

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

    const handleBulkReassign = (userId: number) => {
        const ids = Array.from(selected);
        const assignee = employees?.find(
            (employee) => employee.id === userId,
        );
        applyBulkAction(
            {
                row_ids: ids.join(","),
                action_type: "change-assignee",
                user_id: [userId],
            },
            {
                onSuccess: () => {
                    setTasks((prev) =>
                        prev.map((task) =>
                            ids.includes(task.id)
                                ? ({
                                      ...task,
                                      users: assignee
                                          ? [
                                                {
                                                    id: assignee.id,
                                                    name: assignee.name,
                                                },
                                            ]
                                          : [],
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
                    aria-label={t("pages.deals.workspace.tasks.filter_aria_label")}
                >
                    {(["open", "done", "all"] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            className="dr-filter"
                            aria-pressed={filter === option}
                            onClick={() => setFilter(option)}
                        >
                            {filterLabels[option]}
                        </button>
                    ))}
                </div>

                <div className="flex gap-1.5">
                    {canManageTaskCategories && (
                        <DealButton
                            variant="ghost"
                            size="sm"
                            icon={<SettingOutlined />}
                            title={t("modules.tasks.taskCategory")}
                            aria-label={t("modules.tasks.taskCategory")}
                            onClick={() => setTaskSettingsOpen(true)}
                        />
                    )}
                    {showSelectMode && (
                        <DealButton
                            variant="ghost"
                            onClick={() =>
                                selectMode
                                    ? exitSelectMode()
                                    : setSelectMode(true)
                            }
                        >
                            {selectMode
                                ? t("pages.deals.common.cancel")
                                : t("pages.deals.common.select")}
                        </DealButton>
                    )}
                    {showAddTask && (
                        <DealButton variant="primary" size="sm" onClick={onAddTask}>
                            + {t("pages.deals.workspace.tasks.add_task")}
                        </DealButton>
                    )}
                </div>
            </div>

            {selectMode && (
                <DealBulkActionBar
                    count={selected.size}
                    onClear={() => setSelected(new Set())}
                    clearLabel={t("pages.deals.common.clear")}
                >
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.WHITE, color: T.NAVY }}
                        onClick={toggleSelectAll}
                    >
                        {allSelected
                            ? t("pages.deals.common.deselect_all")
                            : t("pages.deals.common.select_all")}
                    </button>
                    <DealMenuSelect
                        value={null}
                        placeholder={t("pages.deals.workspace.tasks.set_status_placeholder")}
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
                                label: td(column.column_name, { source: "en" }),
                            }))}
                        onChange={(value) => handleBulkStatusChange(Number(value))}
                    />
                    {canBulkReassign && (
                        <BulkReassignButton
                            people={employeeOptions}
                            disabled={!selected.size || isBulkActing}
                            onPick={handleBulkReassign}
                        />
                    )}
                    {canBulkDelete && (
                        <button
                            type="button"
                            className="dr-btn dr-btn-sm"
                            style={{ background: T.RED, color: T.WHITE }}
                            disabled={!selected.size || isBulkActing}
                            onClick={() => setConfirmBulkDelete(true)}
                        >
                            {t("pages.deals.common.delete")}
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
                        {t("pages.deals.workspace.tasks.no_items_prefix")} {filterLabels[filter]}{" "}
                        {t("pages.deals.workspace.tasks.tasks_label")}
                    </p>
                    {showAddTask && (
                        <DealButton variant="primary" size="sm" onClick={onAddTask}>
                            + {t("pages.deals.workspace.tasks.add_task")}
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

                    const displayTitle =
                        task.title === "Untitled task"
                            ? t("pages.deals.common.untitled_task")
                            : task.title;

                    return (
                        <article
                            key={task.id}
                            className="mb-2 flex flex-wrap items-start gap-3 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3 last:mb-0"
                            style={{ opacity: done ? 0.65 : 1 }}
                        >
                            {selectMode && (
                                <div className="pt-0.5">
                                    <DealSelectCheckbox
                                        checked={selected.has(task.id)}
                                        onChange={() => toggleSelect(task.id)}
                                        label={t("pages.deals.common.select_task", {
                                            title: displayTitle,
                                        })}
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
                                        ? t("pages.deals.common.select_task", {
                                              title: displayTitle,
                                          })
                                        : t("pages.deals.common.open_task", {
                                              title: displayTitle,
                                          })
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
                                        {displayTitle}
                                    </span>
                                    <IntegrationOriginBadge
                                        origin={task.integrationOrigin}
                                    />
                                    <DealPriorityBadge
                                        priority={task.priority}
                                    />
                                </div>
                                {task.descriptionText && (
                                    <div
                                        className="mb-1.5 text-xs leading-normal break-words"
                                        style={{
                                            color: T.TEXT_MUTED,
                                            overflowWrap: "break-word",
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        {task.descriptionText}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#5b6472]">
                                    {task.dueDateLabel && (
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
                                            {overdue &&
                                                ` · ${t("pages.deals.workspace.tasks.overdue")}`}
                                        </span>
                                    )}
                                    {task.assignees.length > 0 && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <MultiUserIndicator
                                                users={task.assignees.map(
                                                    (person) => ({
                                                        id: person.id,
                                                        name: person.name,
                                                    }),
                                                )}
                                                size="xs"
                                                maxCount={3}
                                                showNames={false}
                                                colorful
                                            />
                                            {task.assignees.length === 1
                                                ? task.assignees[0].name
                                                : `${task.assignees.length} ${t(
                                                      "pages.deals.workspace.tasks.assignees_label",
                                                  )}`}
                                        </span>
                                    )}
                                </div>
                            </button>

                            <div className="shrink-0">
                                <TaskStatusDropdownPill
                                    status={statusSlug}
                                    columns={taskBoardColumns}
                                    disabled={
                                        selectMode ||
                                        (isWatcherOnly &&
                                            rawTask?.added_by !== userId)
                                    }
                                    loading={isPending(task.id)}
                                    onChange={(slug) => setStatus(task.id, slug)}
                                />
                            </div>
                        </article>
                    );
                })
            )}

            {useRedesignedTasks ? (
                <>
                    <TaskRedesignDetailModal
                        task={selectedTask as unknown as RedesignedTask | null}
                        columns={taskBoardColumns}
                        permissions={permissions as unknown as TaskPermissionSet}
                        currentUser={{
                            id: props.auth?.user?.id ?? 0,
                            name: props.auth?.user?.name ?? "",
                            image: props.auth?.user?.image_url,
                        }}
                        people={employeeOptions.map((employee) => ({
                            id: employee.id,
                            name: employee.name,
                        }))}
                        toggling={
                            selectedTask ? isPending(selectedTask.id) : false
                        }
                        onClose={() => setSelectedTaskId(null)}
                        onEdit={() => {
                            if (selectedTaskId) setEditingTaskId(selectedTaskId);
                        }}
                        onToggleDone={() => {
                            if (!selectedTask) return;
                            const done = isTaskDone(
                                selectedTask,
                                taskBoardColumns,
                            );
                            const target = done
                                ? taskBoardColumns.find(
                                      (column) =>
                                          column.slug === "in_progress" ||
                                          column.slug === "to_do",
                                  )
                                : taskBoardColumns.find(
                                      (column) => column.slug === "done",
                                  );
                            if (target) setStatus(selectedTask.id, target.slug);
                        }}
                    />
                    <TaskRedesignFormModal
                        open={editingTaskId !== null}
                        mode="edit"
                        editingTask={editingTask as unknown as RedesignedTask | null}
                        columns={taskBoardColumns}
                        categories={taskCategories}
                        users={employeeOptions.map((employee) => ({
                            id: employee.id,
                            name: employee.name,
                        }))}
                        saving={isUpdatingRedesignedTask}
                        errors={updateRedesignedTaskErrors}
                        onClose={() => {
                            setEditingTaskId(null);
                            clearUpdateRedesignedErrors();
                        }}
                        onSubmit={(values: TaskFormValues) => {
                            if (!editingTaskId) return;
                            updateRedesignedTask(
                                editingTaskId,
                                {
                                    title: values.title,
                                    startDate: values.startDate,
                                    dueDate: values.dueDate,
                                    dueTime: values.dueTime,
                                    priority: values.priority,
                                    description: values.description,
                                    assignees: values.assignees,
                                    categoryId: values.categoryId,
                                    boardColumnId:
                                        values.boardColumnId ?? undefined,
                                    links: formLinksPayload(values),
                                },
                                afterUpdateTaskFormSubmit(
                                    editingTaskId,
                                    values,
                                    persistExtras,
                                    () => setEditingTaskId(null),
                                ),
                            );
                        }}
                    />
                </>
            ) : (
                <DealTaskDetailModal
                    task={selectedTask}
                    taskBoardColumns={taskBoardColumns}
                    onClose={() => setSelectedTaskId(null)}
                />
            )}

            <DealConfirmDialog
                open={confirmBulkDelete}
                title={`${t("pages.deals.common.delete")} ${selected.size} ${
                    selected.size === 1
                        ? t("pages.deals.workspace.tasks.item_singular")
                        : t("pages.deals.workspace.tasks.item_plural")
                }?`}
                message={t("pages.deals.workspace.tasks.delete_confirm_message")}
                confirmLabel={t("pages.deals.workspace.tasks.delete_tasks")}
                danger
                confirmLoading={isBulkActing}
                onConfirm={handleBulkDelete}
                onCancel={() => setConfirmBulkDelete(false)}
            />

            <Drawer
                title={t("modules.tasks.taskCategory")}
                open={taskSettingsOpen}
                onClose={() => setTaskSettingsOpen(false)}
                width={520}
                destroyOnClose
                maskClosable={false}
                styles={{ content: { boxShadow: "none" }, wrapper: { boxShadow: "none" } }}
            >
                <TaskCategoryManager />
            </Drawer>
        </div>
    );
}
