import React from "react";
import { Task } from "@/Types/Task";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { Checkbox, Tooltip, Dropdown, Button, MenuProps } from "antd";
import {
    MoreOutlined,
    EyeOutlined,
    EditOutlined,
    CopyOutlined,
    DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
    taskDateTimeToDayjs,
    formatTaskDateTimeCompact,
} from "@/lib/taskDateTime";
import { motion } from "framer-motion";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import { clsx } from "clsx";
import { usePermission } from "@/lib/permissionUtils";
import { PermissionKey } from "@/Types/permission";

dayjs.extend(relativeTime);

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
    onStatusChange: (task: Task, newStatus: string, newColumnId: number) => void;
    td?: (key: string) => string;
}

const PRIORITY_COLORS: Record<string, string> = {
    high: "#ef4444",
    medium: "#f59e0b",
    low: "#94a3b8",
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
    td = (key) => key,
}) => {
    const { user, permissions } = usePermission();

    const hasTaskPermission = (task: Task, permissionName: PermissionKey) => {
        const perm = permissions?.[permissionName];
        if (perm === "all") return true;
        if (!perm || perm === "none") return false;
        const isAdded = task.added_by === user?.id;
        const isOwned = task.users?.some((u) => u.id === user?.id);
        if (perm === "added" && isAdded) return true;
        if (perm === "owned" && isOwned) return true;
        if (perm === "both" && (isAdded || isOwned)) return true;
        return false;
    };

    const handleToggleSelect = (task: Task) => {
        const isSelected = selectedIds.includes(task.id);
        const newIds = isSelected
            ? selectedIds.filter((id) => id !== task.id)
            : [...selectedIds, task.id];
        onSelectionChange(newIds, tasks.filter((t) => newIds.includes(t.id)));
    };

    const handleSelectAll = (e: any) => {
        if (e.target.checked) {
            onSelectionChange(tasks.map((t) => t.id), tasks);
        } else {
            onSelectionChange([], []);
        }
    };

    const isAllSelected = tasks.length > 0 && selectedIds.length === tasks.length;
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < tasks.length;

    if (tasks.length === 0) {
        return (
            <div className="py-10 text-center text-slate-400 text-sm">
                {td("No tasks found.", { source: "en" })}
            </div>
        );
    }

    return (
        <div>
            {/* Column header */}
            <div className="flex items-center border-b border-slate-100 bg-slate-50 px-2 py-1.5">
                {/* Checkbox */}
                <div className="w-8 shrink-0 flex items-center justify-center">
                    <Checkbox
                        checked={isAllSelected}
                        indeterminate={isIndeterminate}
                        onChange={handleSelectAll}
                    />
                </div>
                {/* Stripe placeholder */}
                <div className="w-[3px] shrink-0" />
                <div className="flex-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {td("Task", { source: "en" })}
                </div>
                <div className="w-[110px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {td("Due", { source: "en" })}
                </div>
                <div className="w-[80px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {td("Assignees", { source: "en" })}
                </div>
                <div className="w-[140px] shrink-0 text-right pr-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {td("Status", { source: "en" })}
                </div>
                <div className="w-8 shrink-0" />
            </div>

            {tasks.map((task) => {
                const canEdit = hasTaskPermission(task, "edit_tasks");
                const canDelete = hasTaskPermission(task, "delete_tasks");
                const canSelect = canEdit || canDelete;
                const isSelected = selectedIds.includes(task.id);

                const dueDayjs = task.due_date
                    ? taskDateTimeToDayjs(task.due_date)
                    : null;
                const isOverdue =
                    !!dueDayjs &&
                    dueDayjs.isBefore(dayjs(), "day") &&
                    task.status !== "done";
                const isToday =
                    !!dueDayjs && dueDayjs.isSame(dayjs(), "day");

                const actions: MenuProps["items"] = [
                    {
                        key: "view",
                        label: td("View Details", { source: "en" }),
                        icon: <EyeOutlined />,
                        onClick: () => onView(task),
                    },
                    {
                        key: "edit",
                        label: td("Edit", { source: "en" }),
                        icon: <EditOutlined />,
                        onClick: () => onEdit(task),
                        disabled: !canEdit,
                    },
                    {
                        key: "duplicate",
                        label: td("Duplicate", { source: "en" }),
                        icon: <CopyOutlined />,
                        onClick: () => onDuplicate(task),
                        disabled: permissions["add_tasks"] === "none",
                    },
                    { type: "divider" },
                    {
                        key: "delete",
                        label: td("Delete", { source: "en" }),
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => onDelete(task),
                        disabled: !canDelete,
                    },
                ];

                return (
                    <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={clsx(
                            "group flex min-h-[46px] items-center border-b border-slate-100 px-2 transition-colors last:border-0 hover:bg-slate-50/60",
                            isSelected && "bg-blue-50 hover:bg-blue-50",
                        )}
                    >
                        {/* Checkbox */}
                        <div className="w-8 shrink-0 flex items-center justify-center">
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

                        {/* Priority stripe */}
                        <div
                            className="w-[3px] shrink-0 self-stretch rounded-r"
                            style={{
                                backgroundColor:
                                    PRIORITY_COLORS[task.priority] ?? "#e2e8f0",
                            }}
                        />

                        {/* Title + labels */}
                        <div className="min-w-0 flex-1 px-3 py-2.5">
                            <p
                                className="truncate text-sm font-semibold leading-tight text-slate-800 cursor-pointer hover:underline"
                                onClick={() => onView(task)}
                            >
                                {td(task.heading, { source: "en" })}
                            </p>
                            {task.labels && task.labels.length > 0 && (
                                <div className="mt-0.5 flex gap-1">
                                    {task.labels.slice(0, 3).map((label) => (
                                        <Tooltip key={label.id} title={td(label.label_name, { source: "en" })}>
                                            <div
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: label.label_color }}
                                            />
                                        </Tooltip>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Due date */}
                        <div className="w-[110px] shrink-0 px-1 text-center">
                            {task.due_date ? (
                                <>
                                    <p
                                        className={clsx(
                                            "text-xs font-semibold tabular-nums leading-tight",
                                            isOverdue
                                                ? "text-red-500"
                                                : isToday
                                                  ? "text-amber-500"
                                                  : "text-slate-600",
                                        )}
                                    >
                                        {dueDayjs
                                            ? formatTaskDateTimeCompact(dueDayjs)
                                            : null}
                                    </p>
                                    <p
                                        className={clsx(
                                            "text-[10px] leading-tight",
                                            isOverdue ? "text-red-400" : "text-slate-400",
                                        )}
                                    >
                                        {dueDayjs?.fromNow()}
                                    </p>
                                </>
                            ) : (
                                <span className="text-xs text-slate-300">—</span>
                            )}
                        </div>

                        {/* Assignees */}
                        <div className="w-[80px] shrink-0 flex justify-center px-1">
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
                        <div className="w-[140px] shrink-0 flex justify-end pr-2">
                            <TaskStatusDropdownPill
                                status={task.board_column?.slug || task.status}
                                columns={columns}
                                disabled={!canEdit}
                                onChange={(slug, id) => onStatusChange(task, slug, id)}
                            />
                        </div>

                        {/* Actions */}
                        <div className="w-8 shrink-0 flex justify-center">
                            <Dropdown
                                menu={{ items: actions }}
                                trigger={["click"]}
                                placement="bottomRight"
                            >
                                <Button
                                    size="small"
                                    icon={<MoreOutlined />}
                                    type="text"
                                    className="opacity-0 group-hover:opacity-100"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </Dropdown>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
};

export default TaskListView;
