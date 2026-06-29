import React, { useState, useMemo, useEffect } from "react";
import {
    Card,
    Button,
    Dropdown,
    message,
    MenuProps,
    Drawer,
} from "antd";
import {
    CheckOutlined,
    ClockCircleOutlined,
    AlertOutlined,
    EditOutlined,
    MoreOutlined,
    CopyOutlined,
    DeleteOutlined,
    EyeOutlined,
    PlusOutlined,
    DownOutlined,
    RightOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Link, router, usePage } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { SaveTaskModal, TaskDetailsDrawer } from "@/Features/Tasks/SaveTask";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import { TasksIndexProps } from "@/Pages/Tasks/Index";
import TaskStatusDropdownPill, {
    isCompletedColumn,
} from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import { taskApi } from "@/lib/api/tasks";
import { usePermission } from "@/lib/permissionUtils";
import { PermissionKey } from "@/Types/permission";

dayjs.extend(relativeTime);

interface Task {
    id: number;
    heading: string;
    added_by?: number;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high";
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
    deal?: {
        id: number;
        name: string;
    };
    lead?: {
        id: number;
        client_name: string;
        company_name?: string;
    };
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

    const PRIORITY_COLORS: Record<Task["priority"], string> = {
        high: "#ef4444",
        medium: "#f59e0b",
        low: "#94a3b8",
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
                onSuccess: () => {
                    router.reload({
                        only: ["tasks", "stats", "overviewMetrics"],
                    });
                },
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

    const getTaskActions = (task: Task): MenuProps["items"] => [
        // view, edit, duplicate, delete
        {
            key: "view",
            label: "View Task",
            icon: <EyeOutlined />,
            onClick: () => handleViewTask(task),
        },
        {
            key: "edit",
            label: "Edit Task",
            icon: <EditOutlined />,
            onClick: () => handleEditTask(task),
        },
        {
            key: "duplicate",
            label: "Duplicate Task",
            icon: <CopyOutlined />,
            onClick: () => handleDuplicateTask(task),
        },
        // divider
        {
            type: "divider",
        },
        {
            key: "delete",
            label: "Delete Task",
            danger: true,

            icon: <DeleteOutlined className="" />,
            onClick: () => handleDeleteTask(task),
        },
    ];

    // Separate tasks by status and urgency (exclude optimistically completed tasks)
    const visibleTasks = tasks.filter(
        (task) => !isCompletedColumn(getEffectiveStatus(task), columns),
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
        if (task.deal) {
            return (
                <Link
                    href={route("deals.show", task.deal.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-[11px] text-blue-600 hover:underline"
                >
                    {task.deal.name}
                </Link>
            );
        }

        if (task.lead) {
            return (
                <Link
                    href={route("lead-contact.show", task.lead.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-[11px] text-blue-600 hover:underline"
                >
                    {task.lead.client_name}
                </Link>
            );
        }

        if (task.description) {
            return (
                <span className="truncate text-[11px] text-gray-400">
                    {task.description}
                </span>
            );
        }

        return null;
    };

    const renderTask = (task: Task) => {
        const effectiveStatus = getEffectiveStatus(task);
        const isTaskOverdue =
            isOverdue(task.due_date) &&
            !isCompletedColumn(effectiveStatus, columns);
        const isTaskToday = isDueToday(task.due_date);
        const isProcessing = processingTasks.has(task.id);

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={task.id}
                className={`group flex min-h-[46px] items-center border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/60 ${
                    isProcessing ? "opacity-60" : ""
                }`}
            >
                {/* Priority stripe */}
                <div
                    className="w-[3px] shrink-0 self-stretch rounded-r"
                    style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                />

                {/* Task name + linked deal/lead/description */}
                <div className="min-w-0 flex-1 px-3 py-2.5">
                    <p className="truncate text-[13px] font-semibold leading-tight text-slate-800">
                        {task.heading}
                    </p>
                    {renderEntityLink(task) && (
                        <div className="mt-0.5 truncate">
                            {renderEntityLink(task)}
                        </div>
                    )}
                </div>

                {/* Due date */}
                <div className="w-[110px] shrink-0 px-1 text-center">
                    {task.due_date ? (
                        <>
                            <span
                                className={`text-[11px] font-semibold tabular-nums ${
                                    isTaskOverdue
                                        ? "text-red-500"
                                        : isTaskToday
                                          ? "text-amber-500"
                                          : "text-slate-500"
                                }`}
                            >
                                {dayjs(task.due_date).format("MMM D, h:mm A")}
                            </span>
                            <p
                                className={`text-[10px] leading-tight ${
                                    isTaskOverdue
                                        ? "text-red-400"
                                        : "text-slate-400"
                                }`}
                            >
                                {dayjs(task.due_date).fromNow()}
                            </p>
                        </>
                    ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                    )}
                </div>

                {/* Assignee avatars */}
                <div className="flex w-[80px] shrink-0 justify-center px-1">
                    {task.users && task.users.length > 0 && (
                        <MultiUserIndicator
                            users={task.users}
                            size="sm"
                            maxCount={3}
                            showNames={false}
                            colorful
                        />
                    )}
                </div>

                {/* Status */}
                <div className="flex w-[140px] shrink-0 justify-end pr-2">
                    <TaskStatusDropdownPill
                        status={effectiveStatus}
                        columns={columns}
                        disabled={
                            !hasTaskPermission(task, "change_status") ||
                            isProcessing
                        }
                        onChange={(newStatus, columnId) =>
                            handleStatusChange(task, newStatus, columnId)
                        }
                    />
                </div>

                {/* Menu */}
                <div className="flex w-8 shrink-0 justify-center pr-1">
                    <Dropdown
                        menu={{ items: getTaskActions(task) }}
                        trigger={["click"]}
                        placement="bottomRight"
                        overlayClassName="z-[1050]"
                    >
                        <Button
                            size="small"
                            icon={<MoreOutlined />}
                            className="opacity-0 group-hover:opacity-100"
                            type="text"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </Dropdown>
                </div>
            </motion.div>
        );
    };

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
                        {/* Column header bar */}
                        <div className="flex items-center border-b border-slate-100 bg-slate-50 px-2 py-1.5">
                            <div className="w-[3px] shrink-0" />
                            <div className="flex-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Task
                            </div>
                            <div className="w-[110px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Due
                            </div>
                            <div className="w-[80px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Assignee
                            </div>
                            <div className="w-[140px] shrink-0 text-right pr-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Status
                            </div>
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
                                    {overdueOpen && overdueTasks.map(renderTask)}
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
                                            {todayTasks.map(renderTask)}
                                            {upcomingTasks
                                                .slice(0, 5)
                                                .map(renderTask)}
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

            {/* Task Details Drawer */}
            {selectedTask && (
                <Drawer
                    title={`Task: ${selectedTask?.heading || ""}`}
                    placement="right"
                    size="large"
                    open={action === "view"}
                    onClose={() => handleClose()}
                    destroyOnClose
                >
                    <TaskDetailsDrawer task={selectedTask} loading={false} />
                </Drawer>
            )}

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
