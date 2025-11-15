import React, { useState, useEffect, useMemo } from "react";
import {
    Card,
    Table,
    Button,
    Input,
    Select,
    Space,
    Tag,
    Avatar,
    Dropdown,
    Modal,
    Form,
    DatePicker,
    Switch,
    Tooltip,
    Badge,
    Typography,
    Row,
    Col,
    Divider,
    Progress,
    Tabs,
} from "antd";
import {
    PlusOutlined,
    SearchOutlined,
    FilterOutlined,
    MoreOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    BellOutlined,
    ClockCircleOutlined,
    FlagOutlined,
    TeamOutlined,
    FolderOutlined,
    TagOutlined,
    CalendarOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    DownOutlined,
    AppstoreOutlined,
    UnorderedListOutlined,
    ReloadOutlined,
    ExportOutlined,
    ImportOutlined,
    SettingOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import MultiUserIndicator from "@/Components/MultiUserIndicator";

const { Text, Title } = Typography;
const { Option } = Select;
const { Search } = Input;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

// Types based on Laravel Task model
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
}

interface TaskCategory {
    id: number;
    category_name: string;
}

interface TaskLabel {
    id: number;
    label_name: string;
    label_color: string;
}

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface User {
    id: number;
    name: string;
    image?: string;
    designation_name?: string;
}

interface Project {
    id: number;
    project_name: string;
    project_short_code: string;
}

interface TasksIndexProps {
    tasks: Task[];
    categories: TaskCategory[];
    labels: TaskLabel[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];
    filters?: {
        status?: string;
        priority?: string;
        assigned_to?: number;
        project_id?: number;
        category_id?: number;
        due_date_range?: [string, string];
    };
    permissions: {
        add_tasks: boolean;
        edit_tasks: boolean;
        delete_tasks: boolean;
        view_tasks: string; // 'all' | 'added' | 'owned' | 'both'
    };
}

const TasksIndex: React.FC<TasksIndexProps> = ({
    tasks: initialTasks = [],
    categories = [],
    labels = [],
    columns = [],
    users = [],
    projects = [],
    filters = {},
    permissions = {
        add_tasks: true,
        edit_tasks: true,
        delete_tasks: true,
        view_tasks: "all",
    },
}) => {
    // State
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [loading, setLoading] = useState(false);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [searchText, setSearchText] = useState("");
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [activeFilters, setActiveFilters] = useState({
        status: filters.status || "",
        priority: filters.priority || "",
        assigned_to: filters.assigned_to || undefined,
        project_id: filters.project_id || undefined,
        category_id: filters.category_id || undefined,
        due_date_range: filters.due_date_range || undefined,
        search: "",
    });

    // Forms
    const [createForm] = Form.useForm();
    const [editForm] = Form.useForm();

    // Priority colors and icons
    const priorityConfig = {
        low: { color: "#52c41a", icon: "🟢", bg: "#f6ffed" },
        medium: { color: "#faad14", icon: "🟡", bg: "#fffbe6" },
        high: { color: "#ff4d4f", icon: "🔴", bg: "#fff1f0" },
    };

    // Status colors
    const getStatusColor = (status: string) => {
        const column = columns.find((col) => col.slug === status);
        return column?.label_color || "#1890ff";
    };

    // Filtered tasks
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            // Search filter
            if (
                activeFilters.search &&
                !task.heading
                    .toLowerCase()
                    .includes(activeFilters.search.toLowerCase()) &&
                !task.description
                    ?.toLowerCase()
                    .includes(activeFilters.search.toLowerCase())
            ) {
                return false;
            }

            // Status filter
            if (activeFilters.status && task.status !== activeFilters.status) {
                return false;
            }

            // Priority filter
            if (
                activeFilters.priority &&
                task.priority !== activeFilters.priority
            ) {
                return false;
            }

            // Assigned to filter
            if (
                activeFilters.assigned_to &&
                !task.users?.some(
                    (user) => user.id === activeFilters.assigned_to
                )
            ) {
                return false;
            }

            // Project filter
            if (
                activeFilters.project_id &&
                task.project?.id !== activeFilters.project_id
            ) {
                return false;
            }

            // Category filter
            if (
                activeFilters.category_id &&
                task.category?.id !== activeFilters.category_id
            ) {
                return false;
            }

            // Due date range filter
            if (activeFilters.due_date_range && task.due_date) {
                const taskDate = dayjs(task.due_date);
                const [start, end] = activeFilters.due_date_range;
                if (
                    taskDate.isBefore(dayjs(start)) ||
                    taskDate.isAfter(dayjs(end))
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [tasks, activeFilters]);

    // Statistics
    const stats = useMemo(() => {
        const total = filteredTasks.length;
        const completed = filteredTasks.filter(
            (task) => task.status === "completed"
        ).length;
        const overdue = filteredTasks.filter(
            (task) =>
                task.due_date &&
                dayjs(task.due_date).isBefore(dayjs()) &&
                task.status !== "completed"
        ).length;
        const dueToday = filteredTasks.filter(
            (task) =>
                task.due_date && dayjs(task.due_date).isSame(dayjs(), "day")
        ).length;

        return { total, completed, overdue, dueToday };
    }, [filteredTasks]);

    // Table columns
    const tableColumns: ColumnsType<Task> = [
        {
            title: "Task",
            dataIndex: "heading",
            key: "heading",
            width: "30%",
            render: (text: string, record: Task) => (
                <Space
                    direction="vertical"
                    size="small"
                    style={{ width: "100%" }}
                >
                    <Space>
                        <span
                            style={{
                                color: priorityConfig[record.priority]?.color,
                                fontSize: "12px",
                            }}
                        >
                            {priorityConfig[record.priority]?.icon}
                        </span>
                        <Text strong>{text}</Text>
                        {Number(record?.files_count) > 0 && (
                            <Badge count={record.files_count} size="small">
                                <FolderOutlined
                                    style={{ color: "#666", fontSize: "12px" }}
                                />
                            </Badge>
                        )}
                        {Number(record?.comments_count) > 0 && (
                            <Badge count={record.comments_count} size="small">
                                <span
                                    style={{ color: "#666", fontSize: "12px" }}
                                >
                                    💬
                                </span>
                            </Badge>
                        )}
                    </Space>
                    {record.description && (
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                            {record.description.length > 100
                                ? `${record.description.substring(0, 100)}...`
                                : record.description}
                        </Text>
                    )}
                    <Space size="small">
                        {record.labels?.map((label) => (
                            <Tag
                                key={label.id}
                                color={label.label_color}
                                style={{ fontSize: "10px" }}
                            >
                                {label.label_name}
                            </Tag>
                        ))}
                    </Space>
                </Space>
            ),
        },
        {
            title: "Project",
            dataIndex: ["project", "project_name"],
            key: "project",
            width: "15%",
            render: (text: string, record: Task) =>
                record.project ? (
                    <Space>
                        <FolderOutlined style={{ color: "#666" }} />
                        <Text>{text}</Text>
                    </Space>
                ) : (
                    <Text type="secondary">No Project</Text>
                ),
        },
        {
            title: "Assignees",
            dataIndex: "users",
            key: "users",
            width: "15%",
            render: (users: User[]) => (
                <MultiUserIndicator
                    users={
                        users?.map((user) => ({
                            id: user.id,
                            image_url: user.image,
                            name: user.name,
                        })) || []
                    }
                    size="xs"
                    maxCount={3}
                />
            ),
        },
        {
            title: "Status",
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
            title: "Priority",
            dataIndex: "priority",
            key: "priority",
            width: "10%",
            render: (priority: "low" | "medium" | "high") => (
                <Tag
                    color={priorityConfig[priority]?.color}
                    style={{
                        backgroundColor: priorityConfig[priority]?.bg,
                        border: `1px solid ${priorityConfig[priority]?.color}`,
                    }}
                >
                    {priorityConfig[priority]?.icon} {priority.toUpperCase()}
                </Tag>
            ),
        },
        {
            title: "Due Date",
            dataIndex: "due_date",
            key: "due_date",
            width: "12%",
            render: (date: string) => {
                if (!date) return <Text type="secondary">No due date</Text>;

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
                                    : undefined,
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
                if (!record.subtasks_count) return null;

                const progress =
                    record.completed_subtasks_count && record.subtasks_count
                        ? (record.completed_subtasks_count /
                              record.subtasks_count) *
                          100
                        : 0;

                return (
                    <Tooltip
                        title={`${record.completed_subtasks_count || 0} / ${
                            record.subtasks_count
                        } subtasks completed`}
                    >
                        <Progress
                            percent={Math.round(progress)}
                            size="small"
                            showInfo={false}
                            strokeColor={
                                progress === 100 ? "#52c41a" : "#1890ff"
                            }
                        />
                    </Tooltip>
                );
            },
        },
        {
            title: "Actions",
            key: "actions",
            width: "10%",
            render: (_, record: Task) => {
                const actionItems: MenuProps["items"] = [
                    {
                        key: "view",
                        icon: <EyeOutlined />,
                        label: "View Details",
                        onClick: () => handleViewTask(record),
                    },
                    permissions.edit_tasks && {
                        key: "edit",
                        icon: <EditOutlined />,
                        label: "Edit Task",
                        onClick: () => handleEditTask(record),
                    },
                    {
                        key: "duplicate",
                        icon: <span>📋</span>,
                        label: "Duplicate",
                        onClick: () => handleDuplicateTask(record),
                    },
                    ...(permissions?.delete_tasks
                        ? [
                              {
                                  type: "divider",
                              },
                              {
                                  key: "delete",
                                  icon: <DeleteOutlined />,
                                  label: "Delete",
                                  danger: true,
                                  onClick: () => handleDeleteTask(record),
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

    // Handlers
    const handleCreateTask = () => {
        setShowCreateModal(true);
        createForm.resetFields();
    };

    const handleEditTask = (task: Task) => {
        setEditingTask(task);
        editForm.setFieldsValue({
            ...task,
            due_date: task.due_date ? dayjs(task.due_date) : null,
            start_date: task.start_date ? dayjs(task.start_date) : null,
            user_ids: task.users?.map((user) => user.id) || [],
        });
    };

    const handleViewTask = (task: Task) => {
        // Navigate to task detail page
        window.location.href = `/account/tasks/${task.id}`;
    };

    const handleDuplicateTask = (task: Task) => {
        setShowCreateModal(true);
        createForm.setFieldsValue({
            heading: `${task.heading} (Copy)`,
            description: task.description,
            priority: task.priority,
            project_id: task.project?.id,
            category_id: task.category?.id,
            user_ids: task.users?.map((user) => user.id) || [],
        });
    };

    const handleDeleteTask = (task: Task) => {
        Modal.confirm({
            title: "Delete Task",
            content: `Are you sure you want to delete "${task.heading}"?`,
            okText: "Delete",
            okType: "danger",
            onOk: async () => {
                setLoading(true);
                try {
                    await fetch(`/account/tasks/${task.id}`, {
                        method: "DELETE",
                        headers: {
                            "X-CSRF-TOKEN":
                                document
                                    .querySelector('meta[name="csrf-token"]')
                                    ?.getAttribute("content") || "",
                            Accept: "application/json",
                        },
                    });
                    setTasks((prev) => prev.filter((t) => t.id !== task.id));
                } catch (error) {
                    console.error("Error deleting task:", error);
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleBulkAction = (action: string) => {
        if (selectedRowKeys.length === 0) return;

        Modal.confirm({
            title: `${action} Tasks`,
            content: `Are you sure you want to ${action.toLowerCase()} ${
                selectedRowKeys.length
            } task(s)?`,
            onOk: async () => {
                setLoading(true);
                try {
                    await fetch("/account/tasks/apply-quick-action", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRF-TOKEN":
                                document
                                    .querySelector('meta[name="csrf-token"]')
                                    ?.getAttribute("content") || "",
                            Accept: "application/json",
                        },
                        body: JSON.stringify({
                            action_type: action.toLowerCase(),
                            row_ids: selectedRowKeys.join(","),
                        }),
                    });

                    // Refresh tasks
                    if (action.toLowerCase() === "delete") {
                        setTasks((prev) =>
                            prev.filter((t) => !selectedRowKeys.includes(t.id))
                        );
                    }
                    setSelectedRowKeys([]);
                } catch (error) {
                    console.error("Error in bulk action:", error);
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handleSubmitCreate = async (values: any) => {
        setLoading(true);
        try {
            const response = await fetch("/account/tasks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") || "",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    ...values,
                    due_date: values.due_date?.format("YYYY-MM-DD"),
                    start_date: values.start_date?.format("YYYY-MM-DD"),
                }),
            });

            const data = await response.json();
            if (data.status === "success") {
                setShowCreateModal(false);
                // Refresh or add the new task to the list
                window.location.reload();
            }
        } catch (error) {
            console.error("Error creating task:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitEdit = async (values: any) => {
        if (!editingTask) return;

        setLoading(true);
        try {
            const response = await fetch(`/account/tasks/${editingTask.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") || "",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    ...values,
                    due_date: values.due_date?.format("YYYY-MM-DD"),
                    start_date: values.start_date?.format("YYYY-MM-DD"),
                }),
            });

            const data = await response.json();
            if (data.status === "success") {
                setEditingTask(null);
                // Update task in the list
                setTasks((prev) =>
                    prev.map((t) =>
                        t.id === editingTask.id ? { ...t, ...values } : t
                    )
                );
            }
        } catch (error) {
            console.error("Error updating task:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter handlers
    const handleFilterChange = (key: string, value: any) => {
        setActiveFilters((prev) => ({ ...prev, [key]: value }));
    };

    const clearAllFilters = () => {
        setActiveFilters({
            status: "",
            priority: "",
            assigned_to: undefined,
            project_id: undefined,
            category_id: undefined,
            due_date_range: undefined,
            search: "",
        });
        setSearchText("");
    };

    // Row selection
    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(selectedRowKeys);
        },
        getCheckboxProps: (record: Task) => ({
            disabled: !permissions.edit_tasks && !permissions.delete_tasks,
        }),
    };

    return (
        <DashboardLayout>
            <PageLayout>
                <div style={{ padding: "24px" }}>
                    {/* Header */}
                    <div style={{ marginBottom: "24px" }}>
                        <Space
                            align="center"
                            style={{
                                width: "100%",
                                justifyContent: "space-between",
                            }}
                        >
                            <div>
                                <Title level={2} style={{ margin: 0 }}>
                                    Tasks
                                </Title>
                                <Text type="secondary">
                                    Manage and track your tasks efficiently
                                </Text>
                            </div>
                            <Space>
                                {permissions.add_tasks && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={handleCreateTask}
                                    >
                                        Add Task
                                    </Button>
                                )}
                                <Dropdown
                                    menu={{
                                        items: [
                                            {
                                                key: "export",
                                                icon: <ExportOutlined />,
                                                label: "Export Tasks",
                                            },
                                            {
                                                key: "import",
                                                icon: <ImportOutlined />,
                                                label: "Import Tasks",
                                            },
                                            { type: "divider" },
                                            {
                                                key: "settings",
                                                icon: <SettingOutlined />,
                                                label: "Task Settings",
                                            },
                                        ],
                                    }}
                                    trigger={["click"]}
                                >
                                    <Button icon={<MoreOutlined />} />
                                </Dropdown>
                            </Space>
                        </Space>
                    </div>

                    {/* Stats Cards */}
                    <Row gutter={16} style={{ marginBottom: "24px" }}>
                        <Col span={6}>
                            <Card size="small">
                                <Space>
                                    <div
                                        style={{
                                            backgroundColor: "#1890ff",
                                            borderRadius: "8px",
                                            padding: "12px",
                                            color: "white",
                                        }}
                                    >
                                        <UnorderedListOutlined
                                            style={{ fontSize: "20px" }}
                                        />
                                    </div>
                                    <div>
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: "12px" }}
                                        >
                                            Total Tasks
                                        </Text>
                                        <div
                                            style={{
                                                fontSize: "24px",
                                                fontWeight: "bold",
                                                color: "#1890ff",
                                            }}
                                        >
                                            {stats.total}
                                        </div>
                                    </div>
                                </Space>
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small">
                                <Space>
                                    <div
                                        style={{
                                            backgroundColor: "#52c41a",
                                            borderRadius: "8px",
                                            padding: "12px",
                                            color: "white",
                                        }}
                                    >
                                        <CheckCircleOutlined
                                            style={{ fontSize: "20px" }}
                                        />
                                    </div>
                                    <div>
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: "12px" }}
                                        >
                                            Completed
                                        </Text>
                                        <div
                                            style={{
                                                fontSize: "24px",
                                                fontWeight: "bold",
                                                color: "#52c41a",
                                            }}
                                        >
                                            {stats.completed}
                                        </div>
                                    </div>
                                </Space>
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small">
                                <Space>
                                    <div
                                        style={{
                                            backgroundColor: "#ff4d4f",
                                            borderRadius: "8px",
                                            padding: "12px",
                                            color: "white",
                                        }}
                                    >
                                        <ExclamationCircleOutlined
                                            style={{ fontSize: "20px" }}
                                        />
                                    </div>
                                    <div>
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: "12px" }}
                                        >
                                            Overdue
                                        </Text>
                                        <div
                                            style={{
                                                fontSize: "24px",
                                                fontWeight: "bold",
                                                color: "#ff4d4f",
                                            }}
                                        >
                                            {stats.overdue}
                                        </div>
                                    </div>
                                </Space>
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small">
                                <Space>
                                    <div
                                        style={{
                                            backgroundColor: "#faad14",
                                            borderRadius: "8px",
                                            padding: "12px",
                                            color: "white",
                                        }}
                                    >
                                        <BellOutlined
                                            style={{ fontSize: "20px" }}
                                        />
                                    </div>
                                    <div>
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: "12px" }}
                                        >
                                            Due Today
                                        </Text>
                                        <div
                                            style={{
                                                fontSize: "24px",
                                                fontWeight: "bold",
                                                color: "#faad14",
                                            }}
                                        >
                                            {stats.dueToday}
                                        </div>
                                    </div>
                                </Space>
                            </Card>
                        </Col>
                    </Row>

                    {/* Filters and Search */}
                    {/* <Card style={{ marginBottom: "24px" }}>
                        <Row gutter={16} align="middle">
                            <Col span={8}>
                                <Search
                                    placeholder="Search tasks by title or description..."
                                    value={searchText}
                                    onChange={(e) => {
                                        setSearchText(e.target.value);
                                        handleFilterChange(
                                            "search",
                                            e.target.value
                                        );
                                    }}
                                    onSearch={(value) =>
                                        handleFilterChange("search", value)
                                    }
                                    allowClear
                                />
                            </Col>
                            <Col span={3}>
                                <Select
                                    placeholder="Status"
                                    value={activeFilters.status || undefined}
                                    onChange={(value) =>
                                        handleFilterChange("status", value)
                                    }
                                    allowClear
                                    style={{ width: "100%" }}
                                >
                                    {columns.map((column) => (
                                        <Option
                                            key={column.slug}
                                            value={column.slug}
                                        >
                                            <Tag
                                                color={column.label_color}
                                                style={{ marginRight: 8 }}
                                            >
                                                {column.column_name}
                                            </Tag>
                                        </Option>
                                    ))}
                                </Select>
                            </Col>
                            <Col span={3}>
                                <Select
                                    placeholder="Priority"
                                    value={activeFilters.priority || undefined}
                                    onChange={(value) =>
                                        handleFilterChange("priority", value)
                                    }
                                    allowClear
                                    style={{ width: "100%" }}
                                >
                                    <Option value="low">
                                        <Tag color={priorityConfig.low.color}>
                                            🟢 Low
                                        </Tag>
                                    </Option>
                                    <Option value="medium">
                                        <Tag
                                            color={priorityConfig.medium.color}
                                        >
                                            🟡 Medium
                                        </Tag>
                                    </Option>
                                    <Option value="high">
                                        <Tag color={priorityConfig.high.color}>
                                            🔴 High
                                        </Tag>
                                    </Option>
                                </Select>
                            </Col>
                            <Col span={3}>
                                <Select
                                    placeholder="Assignee"
                                    value={
                                        activeFilters.assigned_to || undefined
                                    }
                                    onChange={(value) =>
                                        handleFilterChange("assigned_to", value)
                                    }
                                    allowClear
                                    style={{ width: "100%" }}
                                >
                                    {users.map((user) => (
                                        <Option key={user.id} value={user.id}>
                                            <Space>
                                                <Avatar
                                                    size="small"
                                                    src={user.image}
                                                >
                                                    {user.name.charAt(0)}
                                                </Avatar>
                                                {user.name}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </Col>
                            <Col span={3}>
                                <Select
                                    placeholder="Project"
                                    value={
                                        activeFilters.project_id || undefined
                                    }
                                    onChange={(value) =>
                                        handleFilterChange("project_id", value)
                                    }
                                    allowClear
                                    style={{ width: "100%" }}
                                >
                                    {projects.map((project) => (
                                        <Option
                                            key={project.id}
                                            value={project.id}
                                        >
                                            {project.project_name}
                                        </Option>
                                    ))}
                                </Select>
                            </Col>
                            <Col span={4}>
                                <Space>
                                    <Button
                                        icon={<FilterOutlined />}
                                        onClick={clearAllFilters}
                                    >
                                        Clear Filters
                                    </Button>
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={() => window.location.reload()}
                                    >
                                        Refresh
                                    </Button>
                                </Space>
                            </Col>
                        </Row>
                    </Card> */}

                    {/* Bulk Actions */}
                    {selectedRowKeys.length > 0 && (
                        <Card
                            style={{
                                marginBottom: "16px",
                                backgroundColor: "#e6f7ff",
                            }}
                        >
                            <Space>
                                <Text>
                                    {selectedRowKeys.length} task(s) selected
                                </Text>
                                <Divider type="vertical" />
                                <Button
                                    size="small"
                                    onClick={() =>
                                        handleBulkAction("change-status")
                                    }
                                >
                                    Change Status
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() =>
                                        handleBulkAction("milestone")
                                    }
                                >
                                    Set Milestone
                                </Button>
                                {permissions.delete_tasks && (
                                    <Button
                                        size="small"
                                        danger
                                        onClick={() =>
                                            handleBulkAction("delete")
                                        }
                                    >
                                        Delete
                                    </Button>
                                )}
                                <Button
                                    size="small"
                                    type="link"
                                    onClick={() => setSelectedRowKeys([])}
                                >
                                    Clear Selection
                                </Button>
                            </Space>
                        </Card>
                    )}

                    {/* View Toggle */}
                    <div style={{ marginBottom: "16px", textAlign: "right" }}>
                        <Button.Group>
                            <Button
                                icon={<UnorderedListOutlined />}
                                type={
                                    viewMode === "list" ? "primary" : "default"
                                }
                                onClick={() => setViewMode("list")}
                            >
                                List
                            </Button>
                            <Button
                                icon={<AppstoreOutlined />}
                                type={
                                    viewMode === "grid" ? "primary" : "default"
                                }
                                onClick={() => setViewMode("grid")}
                            >
                                Grid
                            </Button>
                        </Button.Group>
                    </div>

                    {/* Tasks Table */}
                    <Card>
                        <Table
                            rowSelection={
                                permissions.edit_tasks ||
                                permissions.delete_tasks
                                    ? rowSelection
                                    : undefined
                            }
                            columns={tableColumns}
                            dataSource={filteredTasks}
                            rowKey="id"
                            loading={loading}
                            pagination={{
                                total: filteredTasks.length,
                                pageSize: 50,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total, range) =>
                                    `${range[0]}-${range[1]} of ${total} tasks`,
                            }}
                            scroll={{ x: 1200 }}
                            size="small"
                        />
                    </Card>

                    {/* Create Task Modal */}
                    <Modal
                        title="Create New Task"
                        open={showCreateModal}
                        onCancel={() => setShowCreateModal(false)}
                        footer={null}
                        width={800}
                        destroyOnClose
                    >
                        <Form
                            form={createForm}
                            layout="vertical"
                            onFinish={handleSubmitCreate}
                            requiredMark={false}
                        >
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item
                                        name="heading"
                                        label="Task Title"
                                        rules={[
                                            {
                                                required: true,
                                                message:
                                                    "Please enter task title",
                                            },
                                        ]}
                                    >
                                        <Input placeholder="Enter task title" />
                                    </Form.Item>
                                </Col>
                                <Col span={24}>
                                    <Form.Item
                                        name="description"
                                        label="Description"
                                    >
                                        <Input.TextArea
                                            placeholder="Enter task description"
                                            rows={3}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="priority"
                                        label="Priority"
                                        initialValue="medium"
                                    >
                                        <Select>
                                            <Option value="low">🟢 Low</Option>
                                            <Option value="medium">
                                                🟡 Medium
                                            </Option>
                                            <Option value="high">
                                                🔴 High
                                            </Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="category_id"
                                        label="Category"
                                    >
                                        <Select
                                            placeholder="Select category"
                                            allowClear
                                        >
                                            {categories.map((category) => (
                                                <Option
                                                    key={category.id}
                                                    value={category.id}
                                                >
                                                    {category.category_name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="start_date"
                                        label="Start Date"
                                    >
                                        <DatePicker style={{ width: "100%" }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="due_date" label="Due Date">
                                        <DatePicker style={{ width: "100%" }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="project_id"
                                        label="Project"
                                    >
                                        <Select
                                            placeholder="Select project"
                                            allowClear
                                        >
                                            {projects.map((project) => (
                                                <Option
                                                    key={project.id}
                                                    value={project.id}
                                                >
                                                    {project.project_name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="user_ids"
                                        label="Assignees"
                                    >
                                        <Select
                                            mode="multiple"
                                            placeholder="Select assignees"
                                            allowClear
                                        >
                                            {users.map((user) => (
                                                <Option
                                                    key={user.id}
                                                    value={user.id}
                                                >
                                                    <Space>
                                                        <Avatar
                                                            size="small"
                                                            src={user.image}
                                                        >
                                                            {user.name.charAt(
                                                                0
                                                            )}
                                                        </Avatar>
                                                        {user.name}
                                                    </Space>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                            <div
                                style={{
                                    textAlign: "right",
                                    marginTop: "24px",
                                }}
                            >
                                <Space>
                                    <Button
                                        onClick={() =>
                                            setShowCreateModal(false)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={loading}
                                    >
                                        Create Task
                                    </Button>
                                </Space>
                            </div>
                        </Form>
                    </Modal>

                    {/* Edit Task Modal */}
                    <Modal
                        title="Edit Task"
                        open={!!editingTask}
                        onCancel={() => setEditingTask(null)}
                        footer={null}
                        width={800}
                        destroyOnClose
                    >
                        <Form
                            form={editForm}
                            layout="vertical"
                            onFinish={handleSubmitEdit}
                            requiredMark={false}
                        >
                            <Row gutter={16}>
                                <Col span={24}>
                                    <Form.Item
                                        name="heading"
                                        label="Task Title"
                                        rules={[
                                            {
                                                required: true,
                                                message:
                                                    "Please enter task title",
                                            },
                                        ]}
                                    >
                                        <Input placeholder="Enter task title" />
                                    </Form.Item>
                                </Col>
                                <Col span={24}>
                                    <Form.Item
                                        name="description"
                                        label="Description"
                                    >
                                        <Input.TextArea
                                            placeholder="Enter task description"
                                            rows={3}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="priority" label="Priority">
                                        <Select>
                                            <Option value="low">🟢 Low</Option>
                                            <Option value="medium">
                                                🟡 Medium
                                            </Option>
                                            <Option value="high">
                                                🔴 High
                                            </Option>
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="category_id"
                                        label="Category"
                                    >
                                        <Select
                                            placeholder="Select category"
                                            allowClear
                                        >
                                            {categories.map((category) => (
                                                <Option
                                                    key={category.id}
                                                    value={category.id}
                                                >
                                                    {category.category_name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="start_date"
                                        label="Start Date"
                                    >
                                        <DatePicker style={{ width: "100%" }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="due_date" label="Due Date">
                                        <DatePicker style={{ width: "100%" }} />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="project_id"
                                        label="Project"
                                    >
                                        <Select
                                            placeholder="Select project"
                                            allowClear
                                        >
                                            {projects.map((project) => (
                                                <Option
                                                    key={project.id}
                                                    value={project.id}
                                                >
                                                    {project.project_name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="user_ids"
                                        label="Assignees"
                                    >
                                        <Select
                                            mode="multiple"
                                            placeholder="Select assignees"
                                            allowClear
                                        >
                                            {users.map((user) => (
                                                <Option
                                                    key={user.id}
                                                    value={user.id}
                                                >
                                                    <Space>
                                                        <Avatar
                                                            size="small"
                                                            src={user.image}
                                                        >
                                                            {user.name.charAt(
                                                                0
                                                            )}
                                                        </Avatar>
                                                        {user.name}
                                                    </Space>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                            <div
                                style={{
                                    textAlign: "right",
                                    marginTop: "24px",
                                }}
                            >
                                <Space>
                                    <Button
                                        onClick={() => setEditingTask(null)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={loading}
                                    >
                                        Update Task
                                    </Button>
                                </Space>
                            </div>
                        </Form>
                    </Modal>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default TasksIndex;
