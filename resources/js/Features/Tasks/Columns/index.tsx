import { getStatusColor } from "@/lib/utils";
import {
    Space,
    Tag,
    Typography,
    Progress,
    Tooltip,
    Dropdown,
    Button,
    Avatar,
} from "antd";
import type { TableColumnsType } from "antd";
import {
    CalendarOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
    CheckSquareOutlined,
    DownOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import { Link, usePage } from "@inertiajs/react";

import PageDataSorter from "@/Components/PageDataSorter";
import { Task } from "@/Types/Task";
import MultiUserIndicator from "@/Components/MultiUserIndicator";

const { Text, Title } = Typography;

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

    // Priority colors and icons
    const priorityConfig = {
        low: { color: "#52c41a", icon: "🟢", bg: "#f6ffed" },
        medium: { color: "#1890ff", icon: "🔵", bg: "#e6f7ff" },
        high: { color: "#ff4d4f", icon: "🔴", bg: "#fff1f0" },
    };

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
            render: (_: string, record: Task) => (
                <div className="space-y-2 max-w-full">
                    <div>
                        <Tooltip title={record.heading}>
                            <span
                                className="cursor-pointer hover:underline"
                                onClick={() => onView(record)}
                            >
                                {record.heading}
                            </span>
                        </Tooltip>
                    </div>
                    {record.labels && record.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {record.labels.slice(0, 2).map((label) => (
                                <Tag key={label.id} color={label.label_color}>
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
                                    <Tag>+{record.labels.length - 2}</Tag>
                                </Tooltip>
                            )}
                        </div>
                    )}
                </div>
            ),
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
                    <Dropdown
                        menu={{
                            items: columns.map((col) => ({
                                key: col.id,
                                label: (
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: col.label_color }}
                                        />
                                        <span>{col.column_name}</span>
                                    </div>
                                ),
                                onClick: () => onStatusChange(record, col.slug, col.id),
                            })),
                        }}
                        trigger={["click"]}
                    >
                        <span
                            className="px-2 py-0.5 rounded text-xs font-medium border capitalize cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center gap-1"
                            style={{
                                borderColor: boardColumn?.label_color || "#d9d9d9",
                                color: boardColumn?.label_color || "#666",
                                backgroundColor: "white",
                            }}
                        >
                            {(boardColumn?.column_name || status).split("_").join(" ")}
                            <DownOutlined style={{ fontSize: "10px" }} />
                        </span>
                    </Dropdown>
                );
            },
        },
        {
            title: (
                <span className="flex items-center">
                    Priority
                    <PageDataSorter
                        label="Priority"
                        field="priority"
                        routeName="tasks.index"
                    />
                </span>
            ),
            dataIndex: "priority",
            key: "priority",
            width: "10%",
            render: (priority: "low" | "medium" | "high") => (
                <Tag color={priorityConfig[priority]?.color}>
                    {priority.toUpperCase()}
                </Tag>
            ),
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
                if (!date) return <span className="text-gray-400">--</span>;

                const dueDate = dayjs(date);
                const now = dayjs();
                const isOverdue = dueDate.isBefore(now, "day");
                const isDueToday = dueDate.isSame(now, "day");

                return (
                    <Space>
                        <CalendarOutlined
                            style={{
                                color: isOverdue
                                    ? "#ff4d4f"
                                    : isDueToday
                                    ? "#faad14"
                                    : "#666",
                            }}
                        />
                        <Text
                            style={{
                                color: isOverdue
                                    ? "#ff4d4f"
                                    : isDueToday
                                    ? "#faad14"
                                    : "inherit",
                            }}
                        >
                            {dueDate.format("MMM D, YYYY h:mm A")}
                        </Text>
                        {isOverdue && <Tag color="error">Overdue</Tag>}
                        {isDueToday && <Tag color="warning">Due Today</Tag>}
                    </Space>
                );
            },
        },
        {
            title: "Assigner",
            key: "assigner",
            render: (_: string, record: Task) => {
                const assigner = record.assigner ?? record.created_by;
                if (!assigner) {
                    return <span className="text-gray-400">--</span>;
                }

                return <MultiUserIndicator users={[assigner]} />;
            },
        },
        {
            title: "Assignee",
            key: "assignee",
            render: (_: string, record: Task) => {
                if (!record.users || record.users.length === 0) {
                    return <span className="text-gray-400">--</span>;
                }

                return <MultiUserIndicator users={record.users} />;
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
                        {dayjs(date).format("MMM DD, YYYY")}
                    </span>
                );
            },
        },
        {
            title: "Actions",
            key: "actions",
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
                        //
                        // disabled: !canEdit,
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
                        // disabled: !canDelete,
                    },

                    ,
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
