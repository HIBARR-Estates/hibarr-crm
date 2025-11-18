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
} from "@ant-design/icons";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { router } from "@inertiajs/react";

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
}

interface TasksActivitiesPanelProps {
    tasks: Task[];
    onTaskUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>;
    onTaskComplete?: (taskId: number) => Promise<void>;
    onTaskReschedule?: (taskId: number, newDueDate: string) => Promise<void>;
    loading?: boolean;
}

const TasksActivitiesPanel: React.FC<TasksActivitiesPanelProps> = ({
    tasks = [],
    onTaskUpdate,
    onTaskComplete,
    onTaskReschedule,
    loading = false,
}) => {
    const [processingTasks, setProcessingTasks] = useState<Set<number>>(
        new Set()
    );
    const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
    const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);

    const isOverdue = (dueDate?: string) => {
        if (!dueDate) return false;
        return dayjs(dueDate).isBefore(dayjs(), "day");
    };

    const isDueToday = (dueDate?: string) => {
        if (!dueDate) return false;
        return dayjs(dueDate).isSame(dayjs(), "day");
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "high":
                return "#ef4444";
            case "medium":
                return "#f59e0b";
            case "low":
                return "#10b981";
            default:
                return "#6b7280";
        }
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

    const handleTaskComplete = useCallback(
        async (task: Task) => {
            if (!onTaskComplete) return;

            setProcessingTasks((prev) => new Set(prev).add(task.id));

            try {
                await onTaskComplete(task.id);
                message.success(`Task "${task.heading}" marked as completed!`);
            } catch (error) {
                message.error("Failed to complete task");
            } finally {
                setProcessingTasks((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(task.id);
                    return newSet;
                });
            }
        },
        [onTaskComplete]
    );

    const handleReschedule = useCallback(async () => {
        if (!rescheduleTask || !selectedDate || !onTaskReschedule) return;

        setProcessingTasks((prev) => new Set(prev).add(rescheduleTask.id));

        try {
            await onTaskReschedule(
                rescheduleTask.id,
                selectedDate.format("YYYY-MM-DD")
            );
            message.success(
                `Task rescheduled to ${selectedDate.format("MMM DD, YYYY")}`
            );
            setRescheduleTask(null);
            setSelectedDate(null);
        } catch (error) {
            message.error("Failed to reschedule task");
        } finally {
            setProcessingTasks((prev) => {
                const newSet = new Set(prev);
                newSet.delete(rescheduleTask.id);
                return newSet;
            });
        }
    }, [rescheduleTask, selectedDate, onTaskReschedule]);

    const openRescheduleModal = (task: Task) => {
        setRescheduleTask(task);
        setSelectedDate(task.due_date ? dayjs(task.due_date) : null);
    };

    const getTaskActions = (task: Task) => [
        {
            key: "complete",
            label: "Mark as Complete",
            icon: <CheckOutlined />,
            onClick: () => handleTaskComplete(task),
            disabled: processingTasks.has(task.id),
        },
        {
            key: "reschedule",
            label: "Reschedule",
            icon: <CalendarOutlined />,
            onClick: () => openRescheduleModal(task),
            disabled: processingTasks.has(task.id),
        },
        {
            key: "edit",
            label: "Edit Task",
            icon: <EditOutlined />,
            onClick: () => router.visit(route("tasks.show", task.id)),
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
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="text-lg">
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

                            <div className="flex items-center space-x-4 text-sm text-gray-600">
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

                        <div className="flex items-center space-x-2 ml-4">
                            <Button
                                type="primary"
                                size="small"
                                icon={<CheckOutlined />}
                                onClick={() => handleTaskComplete(task)}
                                loading={isProcessing}
                                className="shrink-0"
                            >
                                Complete
                            </Button>

                            <Dropdown
                                menu={{ items: getTaskActions(task) }}
                                trigger={["click"]}
                                placement="bottomRight"
                            >
                                <Button
                                    size="small"
                                    icon={<MoreOutlined />}
                                    className="shrink-0"
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
                        <div className="flex items-center space-x-4">
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
                loading={loading}
                className="h-full"
                bodyStyle={{ padding: "0" }}
            >
                <div className="max-h-96 overflow-y-auto p-4">
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

            {/* Reschedule Modal */}
            <Modal
                title={`Reschedule: ${rescheduleTask?.heading}`}
                open={!!rescheduleTask}
                onOk={handleReschedule}
                onCancel={() => {
                    setRescheduleTask(null);
                    setSelectedDate(null);
                }}
                confirmLoading={
                    rescheduleTask
                        ? processingTasks.has(rescheduleTask.id)
                        : false
                }
                width={400}
            >
                <div className="py-4">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            New Due Date
                        </label>
                        <DatePicker
                            value={selectedDate}
                            onChange={setSelectedDate}
                            style={{ width: "100%" }}
                            placeholder="Select new due date"
                            disabledDate={(current) =>
                                current && current < dayjs().startOf("day")
                            }
                        />
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default TasksActivitiesPanel;
