import { getStatusColor } from "@/lib/utils";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import {
    Tag,
    Tooltip,
    Dropdown,
    Button,
} from "antd";
import type { TableColumnsType } from "antd";
import {
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
    CheckSquareOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import { usePage } from "@inertiajs/react";
import {
    taskDateTimeToDayjs,
    formatTaskCompanyTime,
} from "@/lib/taskDateTime";
import { formatCompanyDate } from "@/lib/companyDateTime";

import PageDataSorter from "@/Components/PageDataSorter";
import { getPriorityConfig } from "@/lib/priority";
import { Task } from "@/Types/Task";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import TaskEntityLink from "@/Features/Tasks/Components/TaskEntityLink";

// Types based on Laravel Task model

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface TasksTableColumnsProps {
    columns: TaskboardColumn[];
    permissions: {
        edit_tasks?: string;
        delete_tasks?: string;
        view_tasks?: string;
    };
    onEdit: (task: Task) => void;
    onView: (task: Task) => void;
    onDuplicate: (task: Task) => void;
    onDelete: (task: Task) => void;
    onStatusChange?: (task: Task, newStatus: string, newColumnId: number) => void;
    exclude?: string[];
}

export const useTasksTableColumns = ({
    columns,
    permissions,
    onEdit,
    onView,
    onDuplicate,
    onDelete,
    onStatusChange,
    exclude = [],
}: TasksTableColumnsProps): TableColumnsType<Task> => {
    const { props } = usePage();
    const userId = props.auth.user.id;


    const tableColumns: TableColumnsType<Task> = [
        {
            title: (
                <span className="flex items-center">
                    Title
                    <PageDataSorter field="heading" routeName="tasks.index" />
                </span>
            ),
            dataIndex: "heading",
            key: "heading",
            width: 340,
            render: (_: string, record: Task) => {
                const priority = record.priority as "low" | "medium" | "high";
                const priorityColor = getPriorityConfig(priority).color;
                return (
                    <div className="py-1">
                        <Tooltip title={record.heading}>
                            <span
                                className="cursor-pointer font-medium hover:underline"
                                onClick={() => onView(record)}
                            >
                                {record.heading}
                            </span>
                        </Tooltip>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span
                                className="text-[10px] font-semibold uppercase tracking-wide"
                                style={{ color: priorityColor }}
                            >
                                {priority}
                            </span>
                            {record.labels && record.labels.length > 0 && (
                                <>
                                    <span className="text-gray-300">·</span>
                                    {record.labels.slice(0, 2).map((label) => (
                                        <Tag key={label.id} color={label.label_color} style={{ margin: 0 }}>
                                            {label.label_name}
                                        </Tag>
                                    ))}
                                    {record.labels.length > 2 && (
                                        <Tooltip
                                            title={record.labels
                                                .slice(2)
                                                .map((l) => l.label_name)
                                                .join(", ")}
                                        >
                                            <Tag style={{ margin: 0 }}>+{record.labels.length - 2}</Tag>
                                        </Tooltip>
                                    )}
                                </>
                            )}
                        </div>
                        {record.deals && record.deals.length > 0 ? (
                            <TaskEntityLink
                                type="deal"
                                id={record.deals[0].id}
                                name={record.deals[0].name}
                                className="mt-0.5"
                            />
                        ) : record.leads && record.leads.length > 0 ? (
                            <TaskEntityLink
                                type="lead"
                                id={record.leads[0].id}
                                name={record.leads[0].client_name}
                                className="mt-0.5"
                            />
                        ) : null}
                    </div>
                );
            },
        },

        {
            title: (
                <span className="flex items-center">
                    Status
                    <PageDataSorter
                        label="Status"
                        field="board_column_id"
                        routeName="tasks.index"
                    />
                </span>
            ),
            dataIndex: "status",
            key: "status",
            render: (status: string, record: Task) => {
                const boardColumn = columns.find((col) => col.slug === status);
                if (!onStatusChange) {
                    return (
                        <Tag color={getStatusColor(status)}>
                            {boardColumn?.column_name || status}
                        </Tag>
                    );
                }
                return (
                    <TaskStatusDropdownPill
                        status={status}
                        columns={columns}
                        onChange={(slug, id) => onStatusChange!(record, slug, id)}
                    />
                );
            },
        },
        {
            title: (
                <span className="flex items-center">
                    Due Date
                    <PageDataSorter
                        label="Due Date"
                        field="due_date"
                        routeName="tasks.index"
                    />
                </span>
            ),
            dataIndex: "due_date",
            key: "due_date",
            render: (date: string) => {
                if (!date) return <span className="text-gray-400">—</span>;

                const dueDate = taskDateTimeToDayjs(date);
                if (!dueDate) return <span className="text-gray-400">—</span>;
                const now = dayjs();
                const isOverdue = dueDate.isBefore(now, "day");
                const isDueToday = dueDate.isSame(now, "day");
                const color = isOverdue ? "#ef4444" : isDueToday ? "#f59e0b" : "inherit";

                return (
                    <div className="py-0.5">
                        <div className="font-medium tabular-nums" style={{ color }}>
                            {formatCompanyDate(dueDate)}
                        </div>
                        <div className="text-xs tabular-nums text-gray-400">
                            {formatTaskCompanyTime(dueDate)}
                            {isOverdue && (
                                <span className="ml-1.5 font-semibold text-red-500">· Overdue</span>
                            )}
                            {isDueToday && !isOverdue && (
                                <span className="ml-1.5 font-semibold text-amber-500">· Today</span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Assigner",
            key: "assigner",
            width: 140,
            render: (_: string, record: Task) => {
                const assigner = record.assigner ?? record.created_by;
                if (!assigner) {
                    return <span className="text-gray-400">--</span>;
                }

                return <MultiUserIndicator users={[assigner]} size="sm" showNames colorful />;
            },
        },
        {
            title: "Assignees",
            key: "assignee",
            width: 120,
            render: (_: string, record: Task) => {
                if (!record.users || record.users.length === 0) {
                    return <span className="text-gray-400">--</span>;
                }

                return (
                    <MultiUserIndicator
                        users={record.users}
                        size="sm"
                        showNames={false}
                        maxCount={3}
                        colorful
                    />
                );
            },
        },
        {
            title: (
                <span className="flex items-center">
                    Created
                    <PageDataSorter
                        label="Created"
                        field="created_at"
                        routeName="tasks.index"
                    />
                </span>
            ),
            dataIndex: "created_at",
            key: "created_at",
            render: (date: string) => {
                if (!date) return <span className="text-gray-400">--</span>;

                return (
                    <span className="text-gray-900">
                        {formatCompanyDate(date)}
                    </span>
                );
            },
        },
        {
            title: "",
            key: "actions",
            width: 40,
            render: (_: string, record: Task) => {
                const canEdit =
                    permissions?.edit_tasks === "all" ||
                    (permissions?.edit_tasks === "added" &&
                        record.added_by === userId) ||
                    (permissions?.edit_tasks === "owned" &&
                        record.users?.some((u) => u.id === userId)) ||
                    (permissions?.edit_tasks === "both" &&
                        (record.added_by === userId ||
                            record.users?.some((u) => u.id === userId)));
                // Check permission before displaying the ability to delete a task
                const canDelete =
                    permissions?.delete_tasks === "all" ||
                    (permissions?.delete_tasks === "added" &&
                        record.added_by === userId) ||
                    (permissions?.delete_tasks === "owned" &&
                        record.users?.some((u) => u.id === userId)) ||
                    (permissions?.delete_tasks === "both" &&
                        (record.added_by === userId ||
                            record.users?.some((u) => u.id === userId)));

                const actionItems: MenuProps["items"] = [
                    {
                        key: "view",
                        icon: <EyeOutlined />,
                        label: "View Details",
                        onClick: () => onView(record),
                    },
                    {
                        key: "edit",
                        icon: <EditOutlined />,
                        label: "Edit Task",
                        onClick: () => onEdit(record),
                        disabled: !canEdit,
                    },
                    {
                        key: "duplicate",
                        icon: <CheckSquareOutlined />,
                        label: "Duplicate",
                        onClick: () => onDuplicate(record),
                    },

                    {
                        type: "divider",
                    },
                    {
                        key: "delete",
                        icon: <DeleteOutlined />,
                        label: "Delete",
                        danger: true,
                        onClick: () => onDelete(record),
                        disabled: !canDelete,
                    },
                ].filter(Boolean) as MenuProps["items"];

                return (
                    <Dropdown
                        menu={{ items: actionItems }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            size="small"
                        />
                    </Dropdown>
                );
            },
        },
    ].filter((column) => !exclude.includes(column.key as string));

    return tableColumns;
};
