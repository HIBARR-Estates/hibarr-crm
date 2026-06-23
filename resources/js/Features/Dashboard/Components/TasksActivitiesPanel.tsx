import React, { useState, useMemo, useEffect } from "react";
import {
    Card,
    List,
    Tag,
    Button,
    Dropdown,
    Progress,
    Avatar,
    Tooltip,
    Space,
    DatePicker,
    message,
    Modal,
    MenuProps,
    Drawer,
} from "antd";
import {
    CheckOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    CalendarOutlined,
    EditOutlined,
    MoreOutlined,
    UserOutlined,
    ProjectOutlined,
    CopyOutlined,
    DeleteOutlined,
    EyeOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { router, usePage } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { SaveTaskModal, TaskDetailsDrawer } from "@/Features/Tasks/SaveTask";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import { TasksIndexProps } from "@/Pages/Tasks/Index";
import TaskStatusDropdownPill, {
    isCompletedColumn,
} from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { taskApi } from "@/lib/api/tasks";

dayjs.extend(relativeTime);

interface Task {
    id: number;
    heading: string;
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
            permissions = {
                add_tasks: true,
                edit_tasks: true,
                delete_tasks: true,
                view_tasks: "all",
            },
        },
    } = usePage<TasksIndexProps>();

    const canEditTasks = permissions.edit_tasks !== false;

    const isOverdue = (dueDate?: string) => {
        if (!dueDate) return false;
        return dayjs(dueDate).isBefore(dayjs(), "day");
    };

    const isDueToday = (dueDate?: string) => {
        if (!dueDate) return false;
        return dayjs(dueDate).isSame(dayjs(), "day");
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case "high":
                return "🔴";
            case "medium":
                return "🔵";
            case "low":
                return "🟢";
            default:
                return "⚪";
        }
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
                exit={{ opacity: 0, x: -10 }}
                className="mb-3"
                key={task.id}
            >
                <Card
                    size="small"
                    className={`${
                        isTaskOverdue
                            ? "border-red-200 bg-red-50"
                            : isTaskToday
                              ? "border-amber-200 bg-amber-50"
                              : "border-gray-200 hover:border-blue-300"
                    }`}
                    loading={isProcessing}
                    variant="outlined"
                >
                    <div className="space-y-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 text-xs">
                                {getPriorityIcon(task.priority)}
                            </span>
                            <div className="min-w-0 flex-1 truncate font-medium text-gray-900">
                                {task.heading}
                            </div>
                            <TaskStatusDropdownPill
                                status={effectiveStatus}
                                columns={columns}
                                disabled={!canEditTasks || isProcessing}
                                onChange={(newStatus, columnId) =>
                                    handleStatusChange(task, newStatus, columnId)
                                }
                            />
                            {isTaskOverdue && (
                                <Tag
                                    color="error"
                                    className="!m-0 shrink-0"
                                    icon={<ExclamationCircleOutlined />}
                                >
                                    Overdue
                                </Tag>
                            )}
                            {isTaskToday && (
                                <Tag
                                    color="warning"
                                    className="!m-0 shrink-0"
                                    icon={<ClockCircleOutlined />}
                                >
                                    Due Today
                                </Tag>
                            )}
                            <Dropdown
                                menu={{ items: getTaskActions(task) }}
                                trigger={["click"]}
                                placement="bottomRight"
                                overlayClassName="z-[1050]"
                            >
                                <Button
                                    size="small"
                                    icon={<MoreOutlined />}
                                    className="ml-auto shrink-0"
                                    type="text"
                                />
                            </Dropdown>
                        </div>

                        {(task.due_date ||
                            task.project ||
                            task.assigner ||
                            (task.users && task.users.length > 0)) && (
                            <div className="flex items-center gap-x-4 text-sm text-gray-600">
                                    {task.due_date && (
                                        <span className="flex items-center">
                                            <CalendarOutlined className="mr-1" />
                                            {dayjs(task.due_date).format(
                                                "MMM DD",
                                            )}
                                            <span className="ml-1 text-gray-500">
                                                (
                                                {dayjs(task.due_date).fromNow()}
                                                )
                                            </span>
                                        </span>
                                    )}

                                    {task.project && (
                                        <span className="flex items-center">
                                            <ProjectOutlined className="mr-1" />
                                            {task.project.project_name}
                                        </span>
                                    )}

                                    {task.assigner && (
                                        <div className="flex items-center">
                                            <UserOutlined className="mr-1" />
                                            <Tooltip title={`Assigner: ${task.assigner.name}`}>
                                                <Avatar
                                                    size="small"
                                                    src={task.assigner.image}
                                                    icon={<UserOutlined />}
                                                >
                                                    {!task.assigner.image &&
                                                        task.assigner.name?.charAt(0)}
                                                </Avatar>
                                            </Tooltip>
                                        </div>
                                    )}

                                    {task.users && task.users.length > 0 && (
                                        <div className="flex items-center">
                                            <UserOutlined className="mr-1" />
                                            <Avatar.Group
                                                size="small"
                                                maxCount={3}
                                            >
                                                {task.users.map((user) => (
                                                    <Tooltip
                                                        key={user.id}
                                                        title={user.name}
                                                    >
                                                        <Avatar
                                                            size="small"
                                                            src={user.image}
                                                            icon={
                                                                <UserOutlined />
                                                            }
                                                        >
                                                            {!user.image &&
                                                                user.name?.charAt(
                                                                    0,
                                                                )}
                                                        </Avatar>
                                                    </Tooltip>
                                                ))}
                                            </Avatar.Group>
                                        </div>
                                    )}
                                </div>
                            )}

                            {task.description && (
                                <div className="text-sm text-gray-600 line-clamp-2">
                                    {task.description}
                                </div>
                            )}

                            {task.labels && task.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {task.labels.map((label) => (
                                        <Tag
                                            key={label.id}
                                            color={label.label_color}
                                        >
                                            {label.label_name}
                                        </Tag>
                                    ))}
                                </div>
                            )}
                    </div>
                </Card>
            </motion.div>
        );
    };

    return (
        <>
            <Card
                title={
                    <div className="flex items-center justify-between gap-4">
                        <span>Tasks & Activities</span>
                        <div className="flex items-center gap-x-4">
                            <Button
                                type="primary"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => handleAction("add")}
                            >
                                Add Task
                            </Button>
                            <div className="text-sm font-normal">
                                <Progress
                                    percent={completionRate}
                                    size="small"
                                    strokeColor="#10b981"
                                    trailColor="#e5e7eb"
                                    className="!m-0"
                                    format={(percent) => `${percent}% Complete`}
                                />
                            </div>
                            <Tag color="blue" className="!m-0">
                                {allTasks.length} tasks
                            </Tag>
                        </div>
                    </div>
                }
                className="h-full"
                variant="outlined"
            >
                {allTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[500px] overflow-hidden">
                        <div className="text-center py-8 text-gray-500">
                            <CheckOutlined className="text-4xl text-gray-300 mb-2" />
                            <div>No pending tasks</div>
                            <div className="text-sm">You're all caught up!</div>
                        </div>
                    </div>
                ) : (
                    <div className="max-h-96 overflow-y-auto">
                        {overdueTasks.length > 0 && (
                            <div className="mb-4">
                                <div className="text-red-600 font-medium text-sm mb-3 flex items-center">
                                    <ExclamationCircleOutlined className="mr-2" />
                                    Overdue ({overdueTasks.length})
                                </div>
                                {overdueTasks.map(renderTask)}
                            </div>
                        )}

                        {todayTasks.length > 0 && (
                            <div className="mb-4">
                                <div className="text-amber-600 font-medium text-sm mb-3 flex items-center">
                                    <ClockCircleOutlined className="mr-2" />
                                    Due Today ({todayTasks.length})
                                </div>
                                {todayTasks.map(renderTask)}
                            </div>
                        )}

                        {upcomingTasks.length > 0 && (
                            <div className="mb-4">
                                <div className="text-gray-600 font-medium text-sm mb-3 flex items-center">
                                    <CalendarOutlined className="mr-2" />
                                    Upcoming ({upcomingTasks.length})
                                </div>
                                {upcomingTasks.slice(0, 5).map(renderTask)}
                                {upcomingTasks.length > 5 && (
                                    <div className="text-center py-2">
                                        <Button
                                            type="link"
                                            size="small"
                                            onClick={() =>
                                                router.visit(
                                                    route("tasks.index"),
                                                )
                                            }
                                        >
                                            View {upcomingTasks.length - 5} more
                                            tasks
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
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
