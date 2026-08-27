import React, { useState, useMemo, useEffect } from "react";
import { Card, Button, message } from "antd";
import "./task-view-modal.css";
import {
    CheckOutlined,
    ClockCircleOutlined,
    AlertOutlined,
    PlusOutlined,
    DownOutlined,
    RightOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { router, usePage } from "@inertiajs/react";
import TaskRowList from "@/Features/Tasks/Components/TaskRowList";
import TaskEntityLink from "@/Features/Tasks/Components/TaskEntityLink";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { SaveTaskModal, TaskDetailsModal } from "@/Features/Tasks/SaveTask";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import { TasksIndexProps } from "@/Pages/Tasks/Index";
import { isCompletedColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { taskApi } from "@/lib/api/tasks";
import { usePermission } from "@/lib/permissionUtils";
import { PermissionKey } from "@/Types/permission";
import type { Task as RedesignedTask } from "@/Types/Task";
import useTasksWorkspaceRedesignFlag from "@/Hooks/useTasksWorkspaceRedesignFlag";
import useTasksWorkspaceMutations from "@/Pages/Tasks/Redesign/hooks/useTasksWorkspaceMutations";
import {
    formLinksPayload,
    type TaskFormValues,
} from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import TaskRedesignFormModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignFormModal";
import TaskRedesignDetailModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignDetailModal";
import type { TaskPermissionSet } from "@/Pages/Tasks/Redesign/adapters/taskPermissions";

dayjs.extend(relativeTime);

interface Task {
    id: number;
    heading: string;
    added_by?: number;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    status: string;
    board_column_id?: number;
    board_column?: {
        id: number;
        column_name: string;
        slug: string;
        label_color: string;
    };
    project?: {
        id: number;
        project_name: string;
        project_short_code?: string;
    };
    category?: {
        id: number;
        category_name: string;
    };
    deals?: Array<{
        id: number;
        name: string;
    }>;
    leads?: Array<{
        id: number;
        client_name: string;
        company_name?: string;
    }>;
    users?: Array<{
        id: number;
        name: string;
        image?: string;
    }>;
    assigner?: {
        id: number;
        name: string;
        image?: string;
    };
    labels?: Array<{
        id: number;
        label_name: string;
        label_color: string;
    }>;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    without_duedate?: boolean;
    created_at?: string;
    updated_at?: string;
}

function GroupHeader({
    label,
    count,
    open,
    onToggle,
    variant,
}: {
    label: string;
    count: number;
    open: boolean;
    onToggle: () => void;
    variant: "danger" | "neutral";
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`flex w-full items-center gap-2 border-b px-3 py-1.5 text-left transition-colors ${
                variant === "danger"
                    ? "border-red-100 bg-red-50/70 hover:bg-red-100/60"
                    : "border-slate-100 bg-slate-50 hover:bg-slate-100/60"
            }`}
        >
            {open ? (
                <DownOutlined
                    className={`text-[10px] ${variant === "danger" ? "text-red-400" : "text-slate-400"}`}
                />
            ) : (
                <RightOutlined
                    className={`text-[10px] ${variant === "danger" ? "text-red-400" : "text-slate-400"}`}
                />
            )}
            {variant === "danger" ? (
                <AlertOutlined className="text-xs text-red-500" />
            ) : (
                <ClockCircleOutlined className="text-xs text-slate-400" />
            )}
            <span
                className={`text-xs font-semibold ${variant === "danger" ? "text-red-600" : "text-slate-600"}`}
            >
                {label}
            </span>
            <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                    variant === "danger"
                        ? "bg-red-100 text-red-600"
                        : "bg-slate-200 text-slate-600"
                }`}
            >
                {count}
            </span>
        </button>
    );
}

interface TasksActivitiesPanelProps {
    tasks: Task[];
}

const TasksActivitiesPanel: React.FC<TasksActivitiesPanelProps> = ({
    tasks = [],
}) => {
    const [processingTasks, setProcessingTasks] = useState<Set<number>>(
        new Set(),
    );
    const [statusOverrides, setStatusOverrides] = useState<
        Record<number, string>
    >({});
    const [overdueOpen, setOverdueOpen] = useState(true);
    const [upcomingOpen, setUpcomingOpen] = useState(true);

    useEffect(() => {
        setStatusOverrides({});
    }, [tasks]);

    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();

    const getEffectiveStatus = (task: Task) =>
        statusOverrides[task.id] ?? task.status;

    const {
        props: {
            tasks: initialTasks = [],
            categories = [],
            labels = [],
            columns = [],
            users = [],
            projects = [],
        },
    } = usePage<TasksIndexProps>();

    const { user, permissions: authPermissions } = usePermission();

    const hasTaskPermission = (task: Task, permissionName: PermissionKey) => {
        const perm = authPermissions?.[permissionName];

        if (perm === "all") return true;
        if (!perm || perm === "none") return false;

        const isAdded = task.added_by === user?.id;
        const isOwned = task.users?.some((u) => u.id === user?.id);

        if (perm === "added" && isAdded) return true;
        if (perm === "owned" && isOwned) return true;
        if (perm === "both" && (isAdded || isOwned)) return true;

        return false;
    };

    const isOverdue = (dueDate?: string) => {
        if (!dueDate) return false;
        return dayjs(dueDate).isBefore(dayjs(), "day");
    };

    const isDueToday = (dueDate?: string) => {
        if (!dueDate) return false;
        return dayjs(dueDate).isSame(dayjs(), "day");
    };

    const {
        action,
        selected: selectedTask,
        handleAction,
        handleClose,
    } = useGenericEntityAction<Task>();

    const handleTaskCreated = () => {
        router.reload({ only: ["tasks", "stats", "overviewMetrics"] });
    };

    // Behind crm.tasks-workspace-redesign, this widget's Add/Edit/View
    // actions open the redesigned Tasks modals (comments, activity log,
    // checklist, attachments) instead of the older SaveTaskModal/
    // TaskDetailsModal pair — off, everything below this block is unused
    // and the existing modals render exactly as they always have.
    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    // The widget's task list is a reload-refreshed prop, not local state
    // this panel owns — so the mutation hook's own setTasks patch is a
    // no-op here; handleTaskCreated (a full reload) is what actually
    // refreshes the list after create/update, same as the old modals do.
    const {
        createTask: createRedesignedTask,
        isCreating: isCreatingRedesignedTask,
        createErrors: createRedesignedTaskErrors,
        updateTask: updateRedesignedTask,
        isUpdating: isUpdatingRedesignedTask,
        updateErrors: updateRedesignedTaskErrors,
    } = useTasksWorkspaceMutations(() => {}, selectedTask?.id ?? null);

    const redesignedSelectedTask = selectedTask as unknown as RedesignedTask | null;

    const handleRedesignedSubmit = (values: TaskFormValues) => {
        const input = {
            title: values.title,
            startDate: values.startDate,
            dueDate: values.dueDate,
            dueTime: values.dueTime,
            priority: values.priority,
            description: values.description,
            assignees: values.assignees,
            categoryId: values.categoryId,
            boardColumnId: values.boardColumnId ?? undefined,
            links: formLinksPayload(values),
        };

        if (action === "edit" && selectedTask) {
            updateRedesignedTask(selectedTask.id, input, () => {
                handleClose();
                handleTaskCreated();
            });
        } else {
            createRedesignedTask(input, () => {
                handleClose();
                handleTaskCreated();
            });
        }
    };

    const doneColumn = columns.find((column) => column.slug === "done");
    const openColumn =
        columns.find((column) => column.slug === "in_progress") ??
        columns.find((column) => column.slug === "to_do") ??
        columns[0];

    const handleToggleDoneRedesigned = () => {
        if (!selectedTask) return;
        const done = isCompletedColumn(
            getEffectiveStatus(selectedTask),
            columns,
        );
        const target = done ? openColumn : doneColumn;
        if (target) handleStatusChange(selectedTask, target.slug, target.id);
    };

    const handleEditTask = (task: Task) => {
        handleAction("edit", task);
    };

    const handleViewTask = (task: Task) => {
        handleAction("view", task);
    };

    const handleDuplicateTask = (task: Task) => {
        // Use the SaveTaskModal with isDuplicate flag
        handleAction("duplicate", task);
    };

    const handleDeleteTask = (task: Task) => {
        handleAction("delete", task);
    };

    const handleStatusChange = (
        task: Task,
        newStatus: string,
        _columnId: number,
    ) => {
        const previousStatus = getEffectiveStatus(task);

        setStatusOverrides((prev) => ({ ...prev, [task.id]: newStatus }));
        setProcessingTasks((prev) => new Set(prev).add(task.id));

        updateTaskStatus(
            { taskId: task.id, status: newStatus },
            {
                // No reload on success — the optimistic status override above
                // already reflects the change everywhere on this panel. The
                // task also intentionally stays visible in its group (see
                // `visibleTasks` below) until the user navigates away, rather
                // than vanishing mid-review or the page reloading under them.
                onError: () => {
                    setStatusOverrides((prev) => {
                        const next = { ...prev };
                        if (previousStatus === task.status) {
                            delete next[task.id];
                        } else {
                            next[task.id] = previousStatus;
                        }
                        return next;
                    });
                    message.error("Failed to update task status");
                },
                onSettled: () => {
                    setProcessingTasks((prev) => {
                        const next = new Set(prev);
                        next.delete(task.id);
                        return next;
                    });
                },
            },
        );
    };

    // Separate tasks by status and urgency. Deliberately filter on the
    // task's original (server-provided) status rather than the optimistic
    // effective status — marking a task done here shouldn't make it vanish
    // out from under the user; it should stick around until they navigate
    // away and the panel reloads with a fresh task list.
    const visibleTasks = tasks.filter(
        (task) => !isCompletedColumn(task.status, columns),
    );
    const overdueTasks = visibleTasks.filter((task) =>
        isOverdue(task.due_date),
    );
    const todayTasks = visibleTasks.filter(
        (task) => isDueToday(task.due_date) && !isOverdue(task.due_date),
    );
    const upcomingTasks = visibleTasks.filter(
        (task) =>
            !isOverdue(task.due_date) &&
            !isDueToday(task.due_date) &&
            (!task.due_date || dayjs(task.due_date).isAfter(dayjs(), "day")),
    );

    const allTasks = [...overdueTasks, ...todayTasks, ...upcomingTasks];

    const completionRate = useMemo(() => {
        if (tasks.length === 0) return 0;

        const completedCount = tasks.filter((task) =>
            isCompletedColumn(getEffectiveStatus(task), columns),
        ).length;

        return Math.round((completedCount / tasks.length) * 100);
    }, [tasks, statusOverrides, columns]);

    // Linked deal takes priority over lead; if neither exists, fall back to
    // the task description (clipped to one line) — never show deal + lead together.
    const renderEntityLink = (task: Task) => {
        if (task.deals?.[0]) {
            return (
                <TaskEntityLink
                    type="deal"
                    id={task.deals[0].id}
                    name={task.deals[0].name}
                />
            );
        }

        if (task.leads?.[0]) {
            const lead = task.leads[0];
            return (
                <TaskEntityLink
                    type="lead"
                    id={lead.id}
                    name={`${lead.client_name}${
                        lead.company_name ? ` (${lead.company_name})` : ""
                    }`}
                />
            );
        }

        if (task.description) {
            return (
                <span className="truncate text-xs text-gray-400">
                    {task.description}
                </span>
            );
        }

        return null;
    };

    const sharedRowProps = {
        columns,
        onView: handleViewTask,
        onEdit: handleEditTask,
        onDuplicate: handleDuplicateTask,
        onDelete: handleDeleteTask,
        onStatusChange: (task: Task, newStatus: string, columnId: number) =>
            handleStatusChange(task, newStatus, columnId),
        effectiveStatus: getEffectiveStatus,
        isProcessing: (task: Task) => processingTasks.has(task.id),
        canChangeStatus: (task: Task) => hasTaskPermission(task, "change_status"),
        renderSubtitle: renderEntityLink,
        showHeader: false,
    } as const;

    return (
        <>
            <Card
                title={
                    <div className="flex items-center justify-between gap-4">
                        <span>Tasks</span>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${completionRate}%` }}
                                    />
                                </div>
                                <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-500">
                                    {completionRate}% done
                                </span>
                            </div>
                            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                {allTasks.length} tasks
                            </span>
                            <Button
                                type="primary"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => handleAction("add")}
                            >
                                Add Task
                            </Button>
                        </div>
                    </div>
                }
                className="flex flex-col"
                style={{ height: "60vh" }}
                styles={{ body: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, padding: 0 } }}
                variant="outlined"
            >
                {allTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
                        <div className="text-center py-8 text-gray-500">
                            <CheckOutlined className="text-4xl text-gray-300 mb-2" />
                            <div>No pending tasks</div>
                            <div className="text-sm">You're all caught up!</div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Column header — matches TaskRowList layout */}
                        <div className="flex items-center border-b border-slate-100 bg-slate-50 px-2 py-1.5">
                            <div className="w-[3px] shrink-0" />
                            <div className="flex-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Task</div>
                            <div className="w-[110px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Due</div>
                            <div className="w-[80px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Assignees</div>
                            <div className="w-[140px] shrink-0 text-right pr-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</div>
                            <div className="w-8 shrink-0" />
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {overdueTasks.length > 0 && (
                                <div>
                                    <GroupHeader
                                        label="Overdue"
                                        count={overdueTasks.length}
                                        open={overdueOpen}
                                        onToggle={() =>
                                            setOverdueOpen((o) => !o)
                                        }
                                        variant="danger"
                                    />
                                    {overdueOpen && (
                                        <TaskRowList tasks={overdueTasks as any} {...sharedRowProps} />
                                    )}
                                </div>
                            )}

                            {(todayTasks.length > 0 ||
                                upcomingTasks.length > 0) && (
                                <div>
                                    <GroupHeader
                                        label="Upcoming"
                                        count={
                                            todayTasks.length +
                                            upcomingTasks.length
                                        }
                                        open={upcomingOpen}
                                        onToggle={() =>
                                            setUpcomingOpen((o) => !o)
                                        }
                                        variant="neutral"
                                    />
                                    {upcomingOpen && (
                                        <>
                                            <TaskRowList
                                                tasks={[...todayTasks, ...upcomingTasks.slice(0, 5)] as any}
                                                {...sharedRowProps}
                                            />
                                            {upcomingTasks.length > 5 && (
                                                <div className="text-center py-2">
                                                    <Button
                                                        type="link"
                                                        size="small"
                                                        onClick={() =>
                                                            router.visit(
                                                                route(
                                                                    "tasks.index",
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        View{" "}
                                                        {upcomingTasks.length -
                                                            5}{" "}
                                                        more tasks
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </Card>

            {useRedesignedTasks ? (
                <>
                    <TaskRedesignFormModal
                        open={action === "add" || action === "edit"}
                        mode={action === "edit" ? "edit" : "create"}
                        editingTask={redesignedSelectedTask}
                        columns={columns}
                        categories={categories}
                        users={users}
                        saving={
                            action === "edit"
                                ? isUpdatingRedesignedTask
                                : isCreatingRedesignedTask
                        }
                        errors={
                            action === "edit"
                                ? updateRedesignedTaskErrors
                                : createRedesignedTaskErrors
                        }
                        onClose={handleClose}
                        onSubmit={handleRedesignedSubmit}
                    />
                    <TaskRedesignDetailModal
                        task={action === "view" ? redesignedSelectedTask : null}
                        columns={columns}
                        // AppPermission's scope fields are typed number|string
                        // for the general permission system, but task scopes
                        // specifically are always the string form ('all'/
                        // 'added'/'owned'/'both'/'none') everywhere else this
                        // codebase reads them (TaskController::user()->permission()).
                        permissions={authPermissions as unknown as TaskPermissionSet}
                        currentUser={{
                            id: user?.id ?? 0,
                            name: user?.name ?? "",
                            image: user?.image_url,
                        }}
                        people={users}
                        toggling={
                            selectedTask
                                ? processingTasks.has(selectedTask.id)
                                : false
                        }
                        onClose={() => handleClose()}
                        onEdit={() => selectedTask && handleAction("edit", selectedTask)}
                        onToggleDone={handleToggleDoneRedesigned}
                    />
                </>
            ) : (
                <>
                    {/* Save Task Modal - handles both create and edit */}
                    <SaveTaskModal
                        key="add"
                        open={action === "add"}
                        isDuplicate={false}
                        onClose={handleClose}
                        onSuccess={handleTaskCreated}
                        reloadKeys={["tasks", "stats", "overviewMetrics"]}
                        categories={categories}
                        labels={labels}
                        columns={columns}
                        users={users}
                        projects={projects}
                    />
                    <SaveTaskModal
                        key="edit"
                        open={action === "edit"}
                        task={selectedTask}
                        isDuplicate={false}
                        onClose={handleClose}
                        categories={categories}
                        labels={labels}
                        columns={columns}
                        users={users}
                        projects={projects}
                    />
                    <TaskDetailsModal
                        task={selectedTask}
                        open={action === "view"}
                        onClose={() => handleClose()}
                        columns={columns}
                    />
                </>
            )}

            {/* Duplicate always uses the legacy form — not part of this swap. */}
            <SaveTaskModal
                key="duplicate"
                open={action === "duplicate"}
                task={selectedTask}
                isDuplicate={true}
                onClose={handleClose}
                categories={categories}
                labels={labels}
                columns={columns}
                users={users}
                projects={projects}
            />

            {/* Delete Task Modal */}
            <DeleteTask
                open={action === "delete"}
                task={selectedTask}
                onClose={() => handleClose()}
            />
        </>
    );
};

export default TasksActivitiesPanel;
