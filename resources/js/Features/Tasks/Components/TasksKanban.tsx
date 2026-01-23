import React, { useState, useCallback } from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
} from "@hello-pangea/dnd";
import { Button, MenuProps, message, Tooltip } from "antd";
import {
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
    CopyOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import { Task } from "@/Types/Task";
import KanbanTaskCard from "@/Components/KanbanTaskCard";
// import QuickTaskAdd from "./QuickTaskAdd";

// Types based on Laravel Task model (Deprecated)
// interface Task { ... }

interface TaskboardColumn {
    //     comments_count?: number;
    //     subtasks_count?: number;
    //     completed_subtasks_count?: number;
    //     created_at: string;
    //     updated_at: string;
    //     added_by?: number;
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
        newColumnId: number,
    ) => void;
    onAddTask?: (columnId: number) => void;
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
    onAddTask,
}) => {
    const [processingTasks, setProcessingTasks] = useState<Set<number>>(
        new Set(),
    );

    // Organize tasks by column
    const tasksByColumn = columns.reduce(
        (acc, column) => {
            acc[column.id] = tasks.filter(
                (task) => task.board_column_id === column.id,
            );
            return acc;
        },
        {} as Record<number, Task[]>,
    );

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
        [tasks, columns, permissions, userId, onStatusChange],
    );

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
                icon: <CopyOutlined />,
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

        // Map task users to card users format
        const cardUsers =
            task.users?.map((user) => ({
                id: user.id,
                name: user.name,
                image: user.image,
                image_url: user.image,
            })) || [];

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
                            <KanbanTaskCard
                                users={cardUsers}
                                title={task.heading}
                                description={task.description}
                                actions={actionItems}
                                dueDate={task.due_date}
                                priority={
                                    task.priority as "low" | "medium" | "high"
                                }
                                isOverdue={!!isOverdue}
                                isLoading={isProcessing}
                                isDragging={snapshot.isDragging}
                                onClick={() => onView(task)}
                            />
                        </motion.div>
                    </div>
                )}
            </Draggable>
        );
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex space-x-4 overflow-x-auto pb-4 min-h-[calc(100vh-250px)]">
                {columns.map((column) => (
                    <div
                        key={column.id}
                        className="flex-shrink-0 w-80 flex flex-col bg-white rounded-lg p-2 h-full"
                    >
                        <div className="flex items-center justify-between mb-6 mt-3 px-2">
                            <div className="flex items-center gap-2.5">
                                <h3 className="text-base font-semibold text-gray-800 m-0 tracking-tight">
                                    {column.column_name}
                                </h3>
                                <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{
                                        backgroundColor: column.label_color,
                                    }}
                                />
                                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full min-w-[24px] text-center">
                                    {tasksByColumn[column.id]?.length || 0}
                                </span>
                            </div>
                            {onAddTask && (
                                <Tooltip
                                    title={`Add task to ${column.column_name}`}
                                >
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<PlusOutlined />}
                                        className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                        onClick={() => onAddTask(column.id)}
                                    />
                                </Tooltip>
                            )}
                        </div>

                        <Droppable droppableId={column.id.toString()}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`flex-1 max-h-[calc(100vh-250px)] overflow-x-hidden overflow-y-auto min-h-[100px] rounded-md transition-colors ${
                                        snapshot.isDraggingOver
                                            ? "bg-blue-50"
                                            : ""
                                    }`}
                                >
                                    {tasksByColumn[column.id]?.map(
                                        (task, index) =>
                                            renderTask(task, index),
                                    )}
                                    {provided.placeholder}
                                    <div className="mt-2">
                                        {/* <QuickTaskAdd
                                            boardColumnId={column.id}
                                            placeholder="Add task to column..."
                                        /> */}
                                    </div>
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
