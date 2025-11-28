import React, { useState, useCallback } from "react";
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
} from "@ant-design/icons";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { router, usePage } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { SaveTaskModal, TaskDetailsDrawer } from "@/Features/Tasks/SaveTask";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import { TasksIndexProps } from "@/Pages/Tasks/Index";

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
        new Set()
    );
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

    // Separate tasks by status and urgency
    const overdueTasks = tasks.filter((task) => isOverdue(task.due_date));
    const todayTasks = tasks.filter(
        (task) => isDueToday(task.due_date) && !isOverdue(task.due_date)
    );
    const upcomingTasks = tasks.filter(
        (task) =>
            !isOverdue(task.due_date) &&
            !isDueToday(task.due_date) &&
            (!task.due_date || dayjs(task.due_date).isAfter(dayjs(), "day"))
    );

    const allTasks = [...overdueTasks, ...todayTasks, ...upcomingTasks];

    const renderTask = (task: Task) => {
        const isTaskOverdue = isOverdue(task.due_date);
        const isTaskToday = isDueToday(task.due_date);
        const isProcessing = processingTasks.has(task.id);

        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="mb-3"
            >
                <Card
                    size="small"
                    className={`transition-all duration-200 hover:shadow-md ${
                        isTaskOverdue
                            ? "border-red-200 bg-red-50"
                            : isTaskToday
                            ? "border-amber-200 bg-amber-50"
                            : "border-gray-200 hover:border-blue-300"
                    }`}
                    loading={isProcessing}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-x-1 mb-2">
                                <span className="text-xs">
                                    {getPriorityIcon(task.priority)}
                                </span>
                                <div className="font-medium text-gray-900 truncate">
                                    {task.heading}
                                </div>
                                {isTaskOverdue && (
                                    <Tag
                                        color="error"
                                        icon={<ExclamationCircleOutlined />}
                                    >
                                        Overdue
                                    </Tag>
                                )}
                                {isTaskToday && (
                                    <Tag
                                        color="warning"
                                        icon={<ClockCircleOutlined />}
                                    >
                                        Due Today
                                    </Tag>
                                )}
                            </div>

                            <div className="flex items-center gap-x-4 text-sm text-gray-600">
                                {task.due_date && (
                                    <span className="flex items-center">
                                        <CalendarOutlined className="mr-1" />
                                        {dayjs(task.due_date).format("MMM DD")}
                                        <span className="ml-1 text-gray-500">
                                            ({dayjs(task.due_date).fromNow()})
                                        </span>
                                    </span>
                                )}

                                {task.project && (
                                    <span className="flex items-center">
                                        <ProjectOutlined className="mr-1" />
                                        {task.project.project_name}
                                    </span>
                                )}

                                {task.users && task.users.length > 0 && (
                                    <div className="flex items-center">
                                        <UserOutlined className="mr-1" />
                                        <Avatar.Group size="small" maxCount={3}>
                                            {task.users.map((user) => (
                                                <Tooltip
                                                    key={user.id}
                                                    title={user.name}
                                                >
                                                    <Avatar
                                                        size="small"
                                                        src={user.image}
                                                        icon={<UserOutlined />}
                                                    >
                                                        {!user.image &&
                                                            user.name?.charAt(
                                                                0
                                                            )}
                                                    </Avatar>
                                                </Tooltip>
                                            ))}
                                        </Avatar.Group>
                                    </div>
                                )}
                            </div>

                            {task.description && (
                                <div className="mt-2 text-sm text-gray-600 line-clamp-2">
                                    {task.description}
                                </div>
                            )}

                            {task.labels && task.labels.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
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

                        <div className="flex items-center gap-x-2 ml-4">
                            <Dropdown
                                menu={{ items: getTaskActions(task) }}
                                trigger={["click"]}
                                placement="bottomRight"
                            >
                                <Button
                                    size="small"
                                    icon={<MoreOutlined />}
                                    className="shrink-0"
                                    type="text"
                                />
                            </Dropdown>
                        </div>
                    </div>
                </Card>
            </motion.div>
        );
    };

    const completionRate =
        tasks.length > 0
            ? Math.round(
                  (tasks.filter((t) => t.status === "completed").length /
                      tasks.length) *
                      100
              )
            : 0;

    return (
        <>
            <Card
                title={
                    <div className="flex items-center justify-between">
                        <span>Tasks & Activities</span>
                        <div className="flex items-center gap-x-4">
                            <div className="text-sm font-normal">
                                <Progress
                                    percent={completionRate}
                                    size="small"
                                    strokeColor="#10b981"
                                    trailColor="#e5e7eb"
                                    format={(percent) => `${percent}% Complete`}
                                />
                            </div>
                            <Tag color="blue">{allTasks.length} tasks</Tag>
                        </div>
                    </div>
                }
                className="h-full"
            >
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
                                            router.visit(route("tasks.index"))
                                        }
                                    >
                                        View {upcomingTasks.length - 5} more
                                        tasks
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {allTasks.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <CheckOutlined className="text-4xl text-gray-300 mb-2" />
                            <div>No pending tasks</div>
                            <div className="text-sm">You're all caught up!</div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Save Task Modal - handles both create and edit */}
            <SaveTaskModal
                key="add"
                open={action === "add"}
                isDuplicate={false}
                onClose={handleClose}
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
