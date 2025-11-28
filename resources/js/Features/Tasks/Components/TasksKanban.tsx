import React, { useState, useCallback } from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "@hello-pangea/dnd";
import {
    Card,
    Tag,
    Avatar,
    Tooltip,
    Button,
    Dropdown,
    MenuProps,
    message,
} from "antd";
import {
    ClockCircleOutlined,
    MoreOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
    CheckSquareOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { motion } from "framer-motion";

interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high";
    status: string;
    board_column_id?: number;
    completed_on?: string;
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
    files_count?: number;
    notes_count?: number;
    comments_count?: number;
    subtasks_count?: number;
    completed_subtasks_count?: number;
    created_at: string;
    updated_at: string;
    added_by?: number;
}

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface TasksKanbanProps {
    tasks: Task[];
    columns: TaskboardColumn[];
    permissions: {
        edit_tasks: string;
        delete_tasks: string;
        view_tasks: string;
    };
    userId: number;
    onEdit: (task: Task) => void;
    onView: (task: Task) => void;
    onDuplicate: (task: Task) => void;
    onDelete: (task: Task) => void;
    onStatusChange: (
        taskId: number,
        newStatus: string,
        newColumnId: number
    ) => void;
}

const TasksKanban: React.FC<TasksKanbanProps> = ({
    tasks,
    columns,
    permissions,
    userId,
    onEdit,
    onView,
    onDuplicate,
    onDelete,
    onStatusChange,
}) => {
    const [processingTasks, setProcessingTasks] = useState<Set<number>>(
        new Set()
    );

    // Organize tasks by column
    const tasksByColumn = columns.reduce((acc, column) => {
        acc[column.id] = tasks.filter(
            (task) => task.board_column_id === column.id
        );
        return acc;
    }, {} as Record<number, Task[]>);

    const handleDragEnd = useCallback(
        (result: DropResult) => {
            if (!result.destination) return;

            const { source, destination, draggableId } = result;

            // If dropped in the same position, do nothing
            if (
                source.droppableId === destination.droppableId &&
                source.index === destination.index
            ) {
                return;
            }

            const taskId = parseInt(draggableId);
            const newColumnId = parseInt(destination.droppableId);
            const newColumn = columns.find((col) => col.id === newColumnId);

            if (!newColumn) return;

            // Check permissions
            const task = tasks.find((t) => t.id === taskId);
            if (!task) return;

            const canEdit =
                permissions.edit_tasks === "all" ||
                (permissions.edit_tasks === "added" &&
                    task.added_by === userId) ||
                (permissions.edit_tasks === "owned" &&
                    task.users?.some((u) => u.id === userId)) ||
                (permissions.edit_tasks === "both" &&
                    (task.added_by === userId ||
                        task.users?.some((u) => u.id === userId)));

            if (!canEdit) {
                message.error("You don't have permission to move this task.");
                return;
            }

            setProcessingTasks((prev) => new Set(prev).add(taskId));
            onStatusChange(taskId, newColumn.slug, newColumnId);

            // Optimistic update handled by parent or we can wait for prop update
            setTimeout(() => {
                setProcessingTasks((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(taskId);
                    return newSet;
                });
            }, 1000);
        },
        [tasks, columns, permissions, userId, onStatusChange]
    );

    const priorityConfig = {
        low: { color: "#52c41a", icon: "🟢", bg: "#f6ffed" },
        medium: { color: "#1890ff", icon: "🔵", bg: "#e6f7ff" },
        high: { color: "#ff4d4f", icon: "🔴", bg: "#fff1f0" },
    };

    const renderTask = (task: Task, index: number) => {
        const isProcessing = processingTasks.has(task.id);
        const isOverdue =
            task.due_date &&
            dayjs(task.due_date).isBefore(dayjs(), "day") &&
            task.status !== "completed";

        const canEdit =
            permissions.edit_tasks === "all" ||
            (permissions.edit_tasks === "added" && task.added_by === userId) ||
            (permissions.edit_tasks === "owned" &&
                task.users?.some((u) => u.id === userId)) ||
            (permissions.edit_tasks === "both" &&
                (task.added_by === userId ||
                    task.users?.some((u) => u.id === userId)));

        const canDelete =
            permissions.delete_tasks === "all" ||
            (permissions.delete_tasks === "added" &&
                task.added_by === userId) ||
            (permissions.delete_tasks === "owned" &&
                task.users?.some((u) => u.id === userId)) ||
            (permissions.delete_tasks === "both" &&
                (task.added_by === userId ||
                    task.users?.some((u) => u.id === userId)));

        const actionItems: MenuProps["items"] = [
            {
                key: "view",
                icon: <EyeOutlined />,
                label: "View Details",
                onClick: () => onView(task),
            },
            canEdit && {
                key: "edit",
                icon: <EditOutlined />,
                label: "Edit Task",
                onClick: () => onEdit(task),
            },
            {
                key: "duplicate",
                icon: <CheckSquareOutlined />,
                label: "Duplicate",
                onClick: () => onDuplicate(task),
            },
            ...(canDelete
                ? [
                      {
                          type: "divider",
                      },
                      {
                          key: "delete",
                          icon: <DeleteOutlined />,
                          label: "Delete",
                          danger: true,
                          onClick: () => onDelete(task),
                      },
                  ]
                : []),
        ].filter(Boolean) as MenuProps["items"];

        return (
            <Draggable
                key={task.id}
                draggableId={task.id.toString()}
                index={index}
                isDragDisabled={!canEdit || isProcessing}
            >
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="mb-3"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.02 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Card
                                size="small"
                                loading={isProcessing}
                                className={`transition-all duration-200 ${
                                    snapshot.isDragging
                                        ? "shadow-lg rotate-2 z-50"
                                        : "hover:shadow-md"
                                } ${
                                    isOverdue
                                        ? "border-red-300 bg-red-50"
                                        : "border-gray-200"
                                }`}
                                bodyStyle={{ padding: "12px" }}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Tag
                                                color={
                                                    priorityConfig[
                                                        task.priority
                                                    ]?.color
                                                }
                                                className="mr-0 text-[10px] px-1"
                                            >
                                                {task.priority.toUpperCase()}
                                            </Tag>
                                            {task.project && (
                                                <Tooltip
                                                    title={
                                                        task.project
                                                            .project_name
                                                    }
                                                >
                                                    <span className="text-xs text-gray-500 truncate max-w-[100px]">
                                                        {task.project
                                                            .project_short_code ||
                                                            task.project
                                                                .project_name}
                                                    </span>
                                                </Tooltip>
                                            )}
                                        </div>
                                        <h4
                                            className="text-sm font-medium mb-1 cursor-pointer hover:text-blue-600 line-clamp-2"
                                            onClick={() => onView(task)}
                                        >
                                            {task.heading}
                                        </h4>
                                    </div>
                                    <Dropdown
                                        menu={{ items: actionItems }}
                                        trigger={["click"]}
                                        placement="bottomRight"
                                    >
                                        <Button
                                            type="text"
                                            icon={<MoreOutlined />}
                                            size="small"
                                            className="text-gray-400 hover:text-gray-600 -mr-2 -mt-2"
                                        />
                                    </Dropdown>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex -space-x-2">
                                        {task.users?.slice(0, 3).map((user) => (
                                            <Tooltip
                                                key={user.id}
                                                title={user.name}
                                            >
                                                <Avatar
                                                    src={user.image}
                                                    size="small"
                                                    className="border-2 border-white"
                                                >
                                                    {user.name.charAt(0)}
                                                </Avatar>
                                            </Tooltip>
                                        ))}
                                        {task.users &&
                                            task.users.length > 3 && (
                                                <Avatar
                                                    size="small"
                                                    className="border-2 border-white bg-gray-200 text-gray-600 text-xs"
                                                >
                                                    +{task.users.length - 3}
                                                </Avatar>
                                            )}
                                    </div>

                                    {task.due_date && (
                                        <Tooltip
                                            title={`Due: ${dayjs(
                                                task.due_date
                                            ).format("MMM D, YYYY")}`}
                                        >
                                            <div
                                                className={`flex items-center text-xs ${
                                                    isOverdue
                                                        ? "text-red-500 font-medium"
                                                        : "text-gray-500"
                                                }`}
                                            >
                                                <ClockCircleOutlined className="mr-1" />
                                                {dayjs(task.due_date).format(
                                                    "MMM D"
                                                )}
                                            </div>
                                        </Tooltip>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                                    <div className="flex items-center text-xs text-gray-400 gap-3">
                                        {task.subtasks_count ? (
                                            <Tooltip title="Subtasks">
                                                <span className="flex items-center">
                                                    <CheckSquareOutlined className="mr-1" />
                                                    {
                                                        task.completed_subtasks_count
                                                    }
                                                    /{task.subtasks_count}
                                                </span>
                                            </Tooltip>
                                        ) : null}
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                )}
            </Draggable>
        );
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex space-x-4 overflow-x-auto pb-4 h-full min-h-[calc(100vh-250px)]">
                {columns.map((column) => (
                    <div
                        key={column.id}
                        className="flex-shrink-0 w-80 flex flex-col bg-gray-50 rounded-lg p-2 h-full"
                    >
                        <div className="flex items-center justify-between mb-3 px-2">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                        backgroundColor: column.label_color,
                                    }}
                                />
                                <h3 className="font-semibold text-gray-700 m-0">
                                    {column.column_name}
                                </h3>
                                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                    {tasksByColumn[column.id]?.length || 0}
                                </span>
                            </div>
                        </div>

                        <Droppable droppableId={column.id.toString()}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`flex-1 overflow-y-auto min-h-[100px] rounded-md transition-colors ${
                                        snapshot.isDraggingOver
                                            ? "bg-blue-50"
                                            : ""
                                    }`}
                                >
                                    {tasksByColumn[column.id]?.map(
                                        (task, index) => renderTask(task, index)
                                    )}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </div>
        </DragDropContext>
    );
};

export default TasksKanban;
