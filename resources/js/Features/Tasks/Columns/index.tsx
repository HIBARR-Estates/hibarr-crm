import { getStatusColor } from "@/lib/utils";
import {
    Space,
    Tag,
    Typography,
    Progress,
    Tooltip,
    Dropdown,
    Button,
} from "antd";
import { ColumnsType } from "antd/es/table";
import {
    CalendarOutlined,
    EyeOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
    CheckSquareOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import { Link, usePage } from "@inertiajs/react";

import PageDataSorter from "@/Components/PageDataSorter";
import { Task } from "@/Types/api/tasks";

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
}

export const useTasksTableColumns = ({
    columns,
    permissions,
    onEdit,
    onView,
    onDuplicate,
    onDelete,
}: TasksTableColumnsProps): ColumnsType<Task> => {
    const { props } = usePage();
    const userId = props.auth.user.id;

    // Priority colors and icons
    const priorityConfig = {
        low: { color: "#52c41a", icon: "🟢", bg: "#f6ffed" },
        medium: { color: "#1890ff", icon: "🔵", bg: "#e6f7ff" },
        high: { color: "#ff4d4f", icon: "🔴", bg: "#fff1f0" },
    };

    return [
        {
            title: (
                <span className="flex items-center">
                    Title
                    <PageDataSorter field="heading" routeName="tasks.index" />
                </span>
            ),
            dataIndex: "heading",
            key: "heading",
            width: "30%",
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
            width: "12%",
            render: (status: string) => {
                const column = columns.find((col) => col.slug === status);
                return (
                    <Tag color={getStatusColor(status)}>
                        {column?.column_name || status}
                    </Tag>
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
            width: "12%",
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
                            {dueDate.format("MMM D, YYYY")}
                        </Text>
                        {isOverdue && <Tag color="error">Overdue</Tag>}
                        {isDueToday && <Tag color="warning">Due Today</Tag>}
                    </Space>
                );
            },
        },
        {
            title: "Progress",
            key: "progress",
            width: "10%",
            render: (_, record: Task) => {
                if (!record.subtasks_count)
                    return <span className="text-gray-400">--</span>;

                const progress =
                    record.completed_subtasks_count && record.subtasks_count
                        ? (record.completed_subtasks_count /
                              record.subtasks_count) *
                          100
                        : 0;

                return (
                    <Tooltip
                        title={`${record.completed_subtasks_count || 0} of ${
                            record.subtasks_count
                        } subtasks completed`}
                    >
                        <Progress
                            percent={Math.round(progress)}
                            size="small"
                            showInfo={false}
                            strokeColor={
                                progress === 100
                                    ? "#52c41a"
                                    : progress >= 50
                                    ? "#1890ff"
                                    : "#faad14"
                            }
                        />
                    </Tooltip>
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
            width: "10%",
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
            width: "8%",
            render: (_, record: Task) => {
                const canEdit =
                    permissions?.edit_tasks === "all" ||
                    (permissions?.edit_tasks === "added" &&
                        record.added_by === userId) ||
                    (permissions?.edit_tasks === "owned" &&
                        record.users?.some((u) => u.id === userId)) ||
                    (permissions?.edit_tasks === "both" &&
                        (record.added_by === userId ||
                            record.users?.some((u) => u.id === userId)));

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
                    canEdit && {
                        key: "edit",
                        icon: <EditOutlined />,
                        label: "Edit Task",
                        onClick: () => onEdit(record),
                    },
                    {
                        key: "duplicate",
                        icon: <CheckSquareOutlined />,
                        label: "Duplicate",
                        onClick: () => onDuplicate(record),
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
                                  onClick: () => onDelete(record),
                              },
                          ]
                        : []),
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
    ];
};
