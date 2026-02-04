import React from "react";
import { Task } from "@/Types/Task";
import { Checkbox, Tag, Avatar, Tooltip, Dropdown, MenuProps } from "antd";
import {
    MoreOutlined,
    CalendarOutlined,
    UserOutlined,
    DownOutlined,
    EyeOutlined,
    EditOutlined,
    CopyOutlined,
    DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getStatusColor } from "@/lib/utils";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import { Link } from "@inertiajs/react";
import { clsx } from "clsx";
import { usePermission } from "@/lib/permissionUtils";
import {
    AppPermission,
    PermissionKey,
    PermissionScope,
} from "@/Types/permission";

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface TaskListViewProps {
    tasks: Task[];
    columns: TaskboardColumn[];
    selectedIds: number[];
    onSelectionChange: (selectedIds: number[], selectedTasks: Task[]) => void;
    onEdit: (task: Task) => void;
    onView: (task: Task) => void;
    onDelete: (task: Task) => void;
    onDuplicate: (task: Task) => void;
    onStatusChange: (
        task: Task,
        newStatus: string,
        newColumnId: number,
    ) => void;
}

const PriorityIcon = ({ priority }: { priority: string }) => {
    switch (priority) {
        case "high":
            return (
                <Tooltip title="High Priority">
                    <span className="text-red-500">🔴</span>
                </Tooltip>
            );
        case "medium":
            return (
                <Tooltip title="Medium Priority">
                    <span className="text-orange-400">🟠</span>
                </Tooltip>
            );
        case "low":
            return (
                <Tooltip title="Low Priority">
                    <span className="text-green-500">🟢</span>
                </Tooltip>
            );
        default:
            return (
                <Tooltip title="No Priority">
                    <span className="text-gray-300">⚪</span>
                </Tooltip>
            );
    }
};

const TaskListView: React.FC<TaskListViewProps> = ({
    tasks,
    columns,
    selectedIds,
    onSelectionChange,
    onEdit,
    onView,
    onDelete,
    onDuplicate,
    onStatusChange,
}) => {
    const { user, permissions } = usePermission();

    // TODO: Refactor permission checks into a utility function in the permissionUtils file, also mock as entitty that has fields like added_by and users
    const hasTaskPermission = (task: Task, permissionName: PermissionKey) => {
        const perm = permissions?.[permissionName];

        if (perm === "all") return true;
        if (!perm || perm === "none") return false;

        const isAdded = task.added_by === user?.id; // Safely handle optional user
        const isOwned = task.users?.some((u) => u.id === user?.id);

        if (perm === "added" && isAdded) return true;
        if (perm === "owned" && isOwned) return true;
        if (perm === "both" && (isAdded || isOwned)) return true;

        return false;
    };

    // Helper to handle selection toggle
    const handleToggleSelect = (task: Task) => {
        const isSelected = selectedIds.includes(task.id);
        let newIds: number[];

        if (isSelected) {
            newIds = selectedIds.filter((id) => id !== task.id);
        } else {
            newIds = [...selectedIds, task.id];
        }

        // Reconstruct selected tasks efficiently
        const newTasks = tasks.filter((t) => newIds.includes(t.id));
        onSelectionChange(newIds, newTasks);
    };

    const handleSelectAll = (e: any) => {
        if (e.target.checked) {
            onSelectionChange(
                tasks.map((t) => t.id),
                tasks,
            );
        } else {
            onSelectionChange([], []);
        }
    };

    const isAllSelected =
        tasks.length > 0 && selectedIds.length === tasks.length;
    const isIndeterminate =
        selectedIds.length > 0 && selectedIds.length < tasks.length;

    return (
        <div className="w-full bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="w-8 flex items-center justify-center">
                    <Checkbox
                        checked={isAllSelected}
                        indeterminate={isIndeterminate}
                        onChange={handleSelectAll}
                    />
                </div>
                <div className="w-8 ml-6 flex items-center justify-center">
                    Priority
                </div>
                <div className="flex-1 ml-6">Title</div>
                <div className="w-24 ml-6 flex items-center justify-center">
                    Status
                </div>
                <div className="w-32 ml-6 hidden md:flex items-center justify-center">
                    Assignee
                </div>
                <div className="w-24 ml-6 hidden lg:flex items-center justify-center">
                    Due
                </div>
                <div className="w-10 ml-6"></div>
            </div>

            {/* List */}
            <div className="divide-y divide-gray-100">
                {tasks.map((task) => {
                    const canEdit = hasTaskPermission(task, "edit_tasks");
                    const canDelete = hasTaskPermission(task, "delete_tasks");

                    // Disable checkbox if cannot edit or delete
                    const canSelect = canEdit || canDelete;

                    const actions: MenuProps["items"] = [
                        {
                            key: "view",
                            label: "View Details",
                            icon: <EyeOutlined />,
                            onClick: () => onView(task),
                        },
                        {
                            key: "edit",
                            label: "Edit",
                            icon: <EditOutlined />,
                            onClick: () => onEdit(task),
                            disabled: !canEdit,
                        },
                        {
                            key: "duplicate",
                            label: "Duplicate",
                            icon: <CopyOutlined />,
                            onClick: () => onDuplicate(task),
                            disabled: permissions["add_tasks"] === "none",
                        },
                        {
                            type: "divider",
                        },
                        {
                            key: "delete",
                            label: "Delete",
                            icon: <DeleteOutlined />,
                            danger: true,
                            onClick: () => onDelete(task),
                            disabled: !canDelete,
                        },
                    ];

                    const isSelected = selectedIds.includes(task.id);
                    return (
                        <div
                            key={task.id}
                            className={clsx(
                                "group flex items-center px-4 py-2 hover:bg-gray-50 transition-colors text-sm",
                                isSelected && "bg-blue-50 hover:bg-blue-50",
                            )}
                        >
                            {/* Checkbox */}
                            <div className="w-8 flex items-center justify-center">
                                <Checkbox
                                    checked={isSelected}
                                    disabled={!canSelect}
                                    onChange={() => handleToggleSelect(task)}
                                    className={clsx(
                                        "opacity-0 group-hover:opacity-100 transition-opacity",
                                        isSelected && "opacity-100",
                                    )}
                                />
                            </div>

                            {/* Priority */}
                            <div className="w-8 ml-6 flex items-center justify-center">
                                <PriorityIcon priority={task.priority} />
                            </div>

                            {/* Title & Tags */}
                            <div className="flex-1 ml-6 min-w-0 flex items-center gap-2">
                                <span
                                    className="font-medium text-gray-900 truncate cursor-pointer hover:underline"
                                    onClick={() => onView(task)}
                                >
                                    {task.heading}
                                </span>
                                {task.labels && task.labels.length > 0 && (
                                    <div className="flex gap-1 overflow-hidden">
                                        {task.labels
                                            .slice(0, 3)
                                            .map((label) => (
                                                <div
                                                    key={label.id}
                                                    className="w-2 h-2 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            label.label_color,
                                                    }}
                                                    title={label.label_name}
                                                />
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Status */}
                            <div className="w-24 ml-6 flex items-center justify-center">
                                <Dropdown
                                    menu={{
                                        items: columns.map((col) => ({
                                            key: col.id,
                                            label: (
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{
                                                            backgroundColor:
                                                                col.label_color,
                                                        }}
                                                    />
                                                    <span>
                                                        {col.column_name}
                                                    </span>
                                                </div>
                                            ),
                                            onClick: () =>
                                                onStatusChange(
                                                    task,
                                                    col.slug,
                                                    col.id,
                                                ),
                                        })),
                                    }}
                                    trigger={["click"]}
                                    disabled={!canEdit}
                                >
                                    <span
                                        className="px-2 py-0.5 rounded text-xs font-medium border capitalize cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1"
                                        style={{
                                            borderColor:
                                                task.board_column
                                                    ?.label_color || "#d9d9d9",
                                            color:
                                                task.board_column
                                                    ?.label_color || "#666",
                                            backgroundColor: "white",
                                        }}
                                    >
                                        {(
                                            task.board_column?.column_name ||
                                            task.status
                                        )
                                            .split("_")
                                            .join(" ")}
                                        <DownOutlined
                                            style={{ fontSize: "10px" }}
                                        />
                                    </span>
                                </Dropdown>
                            </div>

                            {/* Assignee */}
                            <div className="w-32 ml-6 hidden md:flex items-center justify-center">
                                <MultiUserIndicator
                                    users={task?.users}
                                    size="xs"
                                />
                            </div>

                            {/* Due Date */}
                            <div className="w-24 ml-6 hidden lg:flex items-center justify-center text-gray-500 text-xs">
                                {task.due_date ? (
                                    <span
                                        className={clsx(
                                            dayjs(task.due_date).isBefore(
                                                dayjs(),
                                            ) &&
                                                task.status !== "done" &&
                                                "text-red-500",
                                        )}
                                    >
                                        {dayjs(task.due_date).format(
                                            "MMM D, h:mm A",
                                        )}
                                    </span>
                                ) : (
                                    <span>-</span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="w-10 ml-6 flex items-center justify-center">
                                <Dropdown
                                    menu={{ items: actions }}
                                    trigger={["click"]}
                                >
                                    <div className="p-1 rounded hover:bg-gray-200 cursor-pointer text-gray-400 group-hover:text-gray-600">
                                        <MoreOutlined />
                                    </div>
                                </Dropdown>
                            </div>
                        </div>
                    );
                })}
                {tasks.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                        No tasks found.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskListView;
