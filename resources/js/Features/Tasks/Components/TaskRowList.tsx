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
import { motion } from "framer-motion";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import TaskEntityLink from "./TaskEntityLink";
import { clsx } from "clsx";

dayjs.extend(relativeTime);

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface TaskRowListProps {
    tasks: Task[];
    columns: TaskboardColumn[];
    onView: (task: Task) => void;
    onEdit: (task: Task) => void;
    onDuplicate: (task: Task) => void;
    onDelete: (task: Task) => void;
    onStatusChange: (task: Task, newStatus: string, columnId: number) => void;
    /** Returns the effective status for a task (used for optimistic dashboard updates). Defaults to task.status. */
    effectiveStatus?: (task: Task) => string;
    /** Returns true while a status update is in-flight (disables the pill). */
    isProcessing?: (task: Task) => boolean;
    /** Per-task edit permission. Defaults to true. */
    canEdit?: (task: Task) => boolean;
    /** Per-task delete permission. Defaults to true. */
    canDelete?: (task: Task) => boolean;
    /** Per-task status-change permission. Defaults to canEdit. */
    canChangeStatus?: (task: Task) => boolean;
    /** When provided, checkbox column is rendered and bulk-select is active. */
    selectedIds?: number[];
    onSelectionChange?: (ids: number[], tasks: Task[]) => void;
    /** Set false when the component is used as one group inside a larger list that already shows the header. */
    showHeader?: boolean;
    /** Renders content below the task title (e.g. entity links on the dashboard, label dots in entity tabs). */
    renderSubtitle?: (task: Task) => React.ReactNode;
    /**
     * Suppresses the entity-link badge for this type in the default subtitle
     * (e.g. on a lead's own Tasks tab, showing "linked to this same lead" is
     * redundant — pass "lead" so it falls back to the deal link, or the task
     * description, instead).
     */
    suppressEntityType?: "deal" | "lead" | "property";
    td?: (key: string) => string;
}

import { getPriorityConfig } from "@/lib/priority";

const TaskRowList: React.FC<TaskRowListProps> = ({
    tasks,
    columns,
    onView,
    onEdit,
    onDuplicate,
    onDelete,
    onStatusChange,
    effectiveStatus,
    isProcessing,
    canEdit = () => true,
    canDelete = () => true,
    canChangeStatus,
    selectedIds,
    onSelectionChange,
    showHeader = true,
    renderSubtitle,
    suppressEntityType,
    td = (k) => k,
}) => {
    const selectable = selectedIds !== undefined && onSelectionChange !== undefined;

    const handleToggle = (task: Task) => {
        if (!selectable) return;
        const isSelected = selectedIds!.includes(task.id);
        const newIds = isSelected
            ? selectedIds!.filter((id) => id !== task.id)
            : [...selectedIds!, task.id];
        onSelectionChange!(newIds, tasks.filter((t) => newIds.includes(t.id)));
    };

    return (
        <div>
            {/* Column header */}
            {showHeader && <div className="flex items-center border-b border-slate-100 bg-slate-50 px-2 py-1.5">
                {selectable && (
                    <div className="w-8 shrink-0 flex items-center justify-center">
                        <Checkbox
                            checked={selectable && tasks.length > 0 && selectedIds!.length === tasks.length}
                            indeterminate={selectable && selectedIds!.length > 0 && selectedIds!.length < tasks.length}
                            onChange={(e) => {
                                if (!selectable) return;
                                if (e.target.checked) {
                                    onSelectionChange!(tasks.map((t) => t.id), tasks);
                                } else {
                                    onSelectionChange!([], []);
                                }
                            }}
                        />
                    </div>
                )}
                <div className="w-[3px] shrink-0" />
                <div className="flex-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {td("Task")}
                </div>
                <div className="w-[110px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {td("Due")}
                </div>
                <div className="w-[80px] shrink-0 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {td("Assignees")}
                </div>
                <div className="w-[140px] shrink-0 text-right pr-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {td("Status")}
                </div>
                <div className="w-8 shrink-0" />
            </div>}

            {tasks.map((task) => {
                const status = effectiveStatus ? effectiveStatus(task) : (task.board_column?.slug || task.status);
                const processing = isProcessing ? isProcessing(task) : false;
                const editable = canEdit(task);
                const deletable = canDelete(task);
                const statusChangeable = canChangeStatus ? canChangeStatus(task) : editable;
                const isSelected = selectable && selectedIds!.includes(task.id);

                const isOverdue =
                    !!task.due_date &&
                    dayjs(task.due_date).isBefore(dayjs(), "day") &&
                    status !== "done";
                const isToday =
                    !!task.due_date && dayjs(task.due_date).isSame(dayjs(), "day");

                const actions: MenuProps["items"] = [
                    {
                        key: "view",
                        label: td("View Details"),
                        icon: <EyeOutlined />,
                        onClick: () => onView(task),
                    },
                    {
                        key: "edit",
                        label: td("Edit"),
                        icon: <EditOutlined />,
                        onClick: () => onEdit(task),
                        disabled: !editable,
                    },
                    {
                        key: "duplicate",
                        label: td("Duplicate"),
                        icon: <CopyOutlined />,
                        onClick: () => onDuplicate(task),
                    },
                    { type: "divider" },
                    {
                        key: "delete",
                        label: td("Delete"),
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: () => onDelete(task),
                        disabled: !deletable,
                    },
                ];

                return (
                    <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={clsx(
                            "group flex min-h-[46px] items-center border-b border-slate-100 px-2 transition-colors last:border-0 hover:bg-slate-50/60",
                            processing && "opacity-60",
                            isSelected && "bg-blue-50 hover:bg-blue-50",
                        )}
                    >
                        {/* Checkbox — only when selection is enabled */}
                        {selectable && (
                            <div className="w-8 shrink-0 flex items-center justify-center">
                                <Checkbox
                                    checked={isSelected}
                                    disabled={!editable && !deletable}
                                    onChange={() => handleToggle(task)}
                                    className={clsx(
                                        "opacity-0 group-hover:opacity-100 transition-opacity",
                                        isSelected && "opacity-100",
                                    )}
                                />
                            </div>
                        )}

                        {/* Priority stripe */}
                        <div
                            className="w-[3px] shrink-0 self-stretch rounded-r"
                            style={{ backgroundColor: getPriorityConfig(task.priority).color }}
                        />

                        {/* Title + subtitle */}
                        <div className="min-w-0 flex-1 px-3 py-2.5">
                            <p
                                className="truncate text-sm font-semibold leading-tight text-slate-800 cursor-pointer hover:underline"
                                onClick={() => onView(task)}
                            >
                                {task.heading}
                            </p>
                            {renderSubtitle ? (
                                (() => {
                                    const sub = renderSubtitle(task);
                                    return sub ? <div className="mt-0.5 truncate">{sub}</div> : null;
                                })()
                            ) : (
                                <div className="mt-0.5 flex flex-col gap-0.5">
                                    {task.deals && task.deals.length > 0 && suppressEntityType !== "deal" ? (
                                        <TaskEntityLink
                                            type="deal"
                                            id={task.deals[0].id}
                                            name={task.deals[0].name}
                                        />
                                    ) : task.leads && task.leads.length > 0 && suppressEntityType !== "lead" ? (
                                        <TaskEntityLink
                                            type="lead"
                                            id={task.leads[0].id}
                                            name={task.leads[0].client_name}
                                        />
                                    ) : (
                                        task.description && (
                                            <p className="truncate text-[11px] text-slate-400 leading-tight">
                                                {task.description}
                                            </p>
                                        )
                                    )}
                                    {task.labels && task.labels.length > 0 && (
                                        <div className="flex gap-1">
                                            {task.labels.slice(0, 3).map((label) => (
                                                <Tooltip key={label.id} title={label.label_name}>
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: label.label_color }}
                                                    />
                                                </Tooltip>
                                            ))}
                                        </div>
                                    )}
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
                                        {dayjs(task.due_date).format("MMM D, h:mm A")}
                                    </p>
                                    <p
                                        className={clsx(
                                            "text-[10px] leading-tight",
                                            isOverdue ? "text-red-400" : "text-slate-400",
                                        )}
                                    >
                                        {dayjs(task.due_date).fromNow()}
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
                                status={status}
                                columns={columns}
                                disabled={!statusChangeable || processing}
                                onChange={(slug, id) => onStatusChange(task, slug, id)}
                            />
                        </div>

                        {/* Actions */}
                        <div className="w-8 shrink-0 flex justify-center pr-1">
                            <Dropdown
                                menu={{ items: actions }}
                                trigger={["click"]}
                                placement="bottomRight"
                                overlayClassName="z-[1050]"
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

export default TaskRowList;
