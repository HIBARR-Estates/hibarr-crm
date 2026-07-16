import React, { useState } from "react";
import { router, Link } from "@inertiajs/react";
import {
    Card,
    Typography,
    Tag,
    Space,
    Avatar,
    Progress,
    Divider,
    Button,
    Tooltip,
    Dropdown,
    Breadcrumb,
    Empty,
    Skeleton,
} from "antd";
import type { MenuProps } from "antd";
import {
    CalendarOutlined,
    UserOutlined,
    FlagOutlined,
    ClockCircleOutlined,
    ProjectOutlined,
    FileOutlined,
    CommentOutlined,
    CheckSquareOutlined,
    TagOutlined,
    EditOutlined,
    DeleteOutlined,
    CopyOutlined,
    MoreOutlined,
    ArrowLeftOutlined,
    LockOutlined,
    DollarOutlined,
    LinkOutlined,
    HomeOutlined,
    UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Task } from "@/Types/Task";
import { getStatusColor } from "@/lib/utils";
import { getPriorityConfig } from "@/lib/priority";
import { SaveTaskModal } from "@/Features/Tasks/SaveTask";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";

dayjs.extend(relativeTime);

const { Text, Title, Paragraph } = Typography;

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

interface Deal {
    id: number;
    name: string;
}

interface Lead {
    id: number;
    client_name: string;
    company_name?: string;
}

interface Property {
    id: number;
    name?: string;
    title?: string;
}

interface SubTask {
    id: number;
    title: string;
    status: string;
    due_date?: string;
}

interface TaskShowProps extends PageProps {
    task: Task & {
        subtasks?: SubTask[];
        files?: Array<{ id: number; filename: string; hashname: string }>;
        comments?: Array<{
            id: number;
            comment: string;
            user: User;
            created_at: string;
        }>;
        added_by_user?: User;
    };
    categories: TaskCategory[];
    labels: TaskLabel[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];
    deals: Deal[];
    leads: Lead[];
    properties: Property[];
    permissions: {
        add_tasks: string;
        edit_tasks: string;
        delete_tasks: string;
        view_tasks: string;
    };
    pageTitle: string;
}


const TaskShow = ({
    task,
    categories = [],
    labels = [],
    columns = [],
    users = [],
    projects = [],
    deals = [],
    leads = [],
    properties = [],
    permissions = {
        add_tasks: "all",
        edit_tasks: "all",
        delete_tasks: "all",
        view_tasks: "all",
    },
    pageTitle,
}: TaskShowProps) => {
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    if (!task) {
        return (
            <PageLayout
                title="Task Not Found"
                breadcrumbs={[
                    { name: "Tasks", url: route("tasks.index") },
                    { name: "Not Found" },
                ]}
            >
                <div className="max-w-4xl mx-auto py-12">
                    <Empty description="Task not found" />
                </div>
            </PageLayout>
        );
    }


    const calculateTimeSpent = () => {
        if (task.time_logs && Array.isArray(task.time_logs)) {
            return task.time_logs.reduce((total: number, log: any) => {
                return total + (log.total_minutes || 0);
            }, 0);
        }
        return 0;
    };

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        return `${mins}m`;
    };

    const estimatedMinutes =
        (task.estimate_hours || 0) * 60 + (task.estimate_minutes || 0);
    const spentMinutes = calculateTimeSpent();
    const progressPercent =
        estimatedMinutes > 0
            ? Math.min((spentMinutes / estimatedMinutes) * 100, 100)
            : 0;

    const isOverdue =
        task.due_date &&
        dayjs().isAfter(dayjs(task.due_date)) &&
        task.status !== "done";
    const subtasksCount = task.subtasks_count || task.subtasks?.length || 0;
    const completedSubtasksCount = task.completed_subtasks_count || 0;
    const subtaskProgress =
        subtasksCount > 0
            ? Math.round((completedSubtasksCount / subtasksCount) * 100)
            : 0;

    // Action dropdown menu
    const actionMenuItems: MenuProps["items"] = [
        {
            key: "edit",
            icon: <EditOutlined />,
            label: "Edit Task",
            onClick: () => setEditModalOpen(true),
            disabled: !["all", "added", "owned", "both"].includes(
                permissions.edit_tasks,
            ),
        },
        {
            key: "duplicate",
            icon: <CopyOutlined />,
            label: "Duplicate Task",
            onClick: () => setDuplicateModalOpen(true),
            disabled: !["all", "added"].includes(permissions.add_tasks),
        },
        { type: "divider" },
        {
            key: "delete",
            icon: <DeleteOutlined />,
            label: "Delete Task",
            danger: true,
            onClick: () => setDeleteModalOpen(true),
            disabled: !["all", "added", "owned", "both"].includes(
                permissions.delete_tasks,
            ),
        },
    ];

    const handleClose = () => {
        setEditModalOpen(false);
        setDuplicateModalOpen(false);
        setDeleteModalOpen(false);
        router.reload();
    };

    const handleDeleteClose = () => {
        setDeleteModalOpen(false);
        router.visit(route("tasks.index"));
    };

    return (
        <>
            <PageLayout
                title={pageTitle || `Task: ${task.heading}`}
                breadcrumbs={[
                    { name: "Dashboard", url: route("dashboard") },
                    { name: "Tasks", url: route("tasks.index") },
                    {
                        name: task.task_short_code
                            ? `#${task.task_short_code}`
                            : task.heading,
                    },
                ]}
            >
                <div className="min-h-screen mx-12">
                    <div className="max-w-10xl mx-auto">
                        {/* Back button and actions */}
                        <div className="flex items-center justify-between mb-6">
                            <Button
                                icon={<ArrowLeftOutlined />}
                                onClick={() =>
                                    router.visit(route("tasks.index"))
                                }
                                type="text"
                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                            >
                                Back to Tasks
                            </Button>

                            <Space>
                                <Button
                                    icon={<EditOutlined />}
                                    onClick={() => setEditModalOpen(true)}
                                    disabled={
                                        ![
                                            "all",
                                            "added",
                                            "owned",
                                            "both",
                                        ].includes(permissions.edit_tasks)
                                    }
                                />
                                <Dropdown
                                    menu={{ items: actionMenuItems }}
                                    trigger={["click"]}
                                >
                                    <Button icon={<MoreOutlined />} />
                                </Dropdown>
                            </Space>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column - Main Content */}
                            <div className="lg:col-span-2 flex flex-col gap-y-6">
                                {/* Task Header Card */}
                                <Card className="shadow-sm" variant="outlined">
                                    <div className="flex flex-col gap-y-4">
                                        {/* Task Code and Badges */}
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <Space>
                                                {task.task_short_code && (
                                                    <Tag
                                                        color="blue"
                                                        className="text-sm font-mono"
                                                    >
                                                        #{task.task_short_code}
                                                    </Tag>
                                                )}
                                                {Boolean(task.is_private) && (
                                                    <Tooltip title="Private Task">
                                                        <Tag
                                                            icon={
                                                                <LockOutlined />
                                                            }
                                                            color="orange"
                                                        >
                                                            Private
                                                        </Tag>
                                                    </Tooltip>
                                                )}
                                                {Boolean(task.billable) && (
                                                    <Tooltip title="Billable Task">
                                                        <Tag
                                                            icon={
                                                                <DollarOutlined />
                                                            }
                                                            color="green"
                                                        >
                                                            Billable
                                                        </Tag>
                                                    </Tooltip>
                                                )}
                                            </Space>
                                            <Text
                                                type="secondary"
                                                className="text-sm"
                                            >
                                                Created{" "}
                                                {dayjs(
                                                    task.created_at,
                                                ).fromNow()}
                                            </Text>
                                        </div>

                                        {/* Title */}
                                        <Title level={3} className="!mb-0">
                                            {task.heading}
                                        </Title>

                                        {/* Status and Priority inline */}
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <Text type="secondary">
                                                    Status:
                                                </Text>
                                                <Tag
                                                    color={getStatusColor(
                                                        task.status,
                                                    )}
                                                >
                                                    {task.board_column
                                                        ?.column_name ||
                                                        task.status}
                                                </Tag>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Text type="secondary">
                                                    Priority:
                                                </Text>
                                                <Tag
                                                    color={
                                                        getPriorityConfig(
                                                            task.priority,
                                                        ).color
                                                    }
                                                    icon={<FlagOutlined />}
                                                >
                                                    {
                                                        getPriorityConfig(
                                                            task.priority,
                                                        ).label
                                                    }
                                                </Tag>
                                            </div>
                                        </div>

                                        <Divider className="!my-4" />

                                        {/* Description */}
                                        <div>
                                            <Text
                                                strong
                                                className="text-gray-600 block mb-2"
                                            >
                                                Description
                                            </Text>
                                            {task.description ? (
                                                <Paragraph className="text-gray-700 whitespace-pre-wrap">
                                                    {task.description}
                                                </Paragraph>
                                            ) : (
                                                <Text type="secondary" italic>
                                                    No description provided
                                                </Text>
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                {/* Subtasks Progress */}
                                {subtasksCount > 0 && (
                                    <Card
                                        title={
                                            <Space>
                                                <CheckSquareOutlined />
                                                <span>Subtasks</span>
                                                <Tag>
                                                    {completedSubtasksCount}/
                                                    {subtasksCount}
                                                </Tag>
                                            </Space>
                                        }
                                        className="shadow-sm"
                                        variant="outlined"
                                    >
                                        <Progress
                                            percent={subtaskProgress}
                                            status={
                                                subtaskProgress === 100
                                                    ? "success"
                                                    : "active"
                                            }
                                            strokeColor={
                                                subtaskProgress === 100
                                                    ? "#52c41a"
                                                    : "#1890ff"
                                            }
                                        />
                                        {task.subtasks &&
                                            task.subtasks.length > 0 && (
                                                <div className="mt-4 flex flex-col gap-y-2">
                                                    {task.subtasks.map(
                                                        (subtask) => (
                                                            <div
                                                                key={subtask.id}
                                                                className={`flex items-center gap-2 p-2 rounded ${
                                                                    subtask.status ===
                                                                    "complete"
                                                                        ? "bg-green-50 line-through text-gray-500"
                                                                        : "bg-gray-50"
                                                                }`}
                                                            >
                                                                <CheckSquareOutlined
                                                                    className={
                                                                        subtask.status ===
                                                                        "complete"
                                                                            ? "text-green-500"
                                                                            : "text-gray-400"
                                                                    }
                                                                />
                                                                <span>
                                                                    {
                                                                        subtask.title
                                                                    }
                                                                </span>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                    </Card>
                                )}

                                {/* Related Entities */}
                                {((task.deals && task.deals.length > 0) ||
                                    (task.leads && task.leads.length > 0) ||
                                    (task.properties &&
                                        task.properties.length > 0)) && (
                                    <Card
                                        title={
                                            <Space>
                                                <LinkOutlined />
                                                <span>Related Entities</span>
                                            </Space>
                                        }
                                        className="shadow-sm"
                                        variant="outlined"
                                    >
                                        <div className="flex flex-col gap-y-4">
                                            {/* Deals */}
                                            {task.deals &&
                                                task.deals.length > 0 && (
                                                    <div>
                                                        <Text
                                                            strong
                                                            className="text-gray-600 block mb-2"
                                                        >
                                                            Deals
                                                        </Text>
                                                        <Space wrap>
                                                            {task.deals.map(
                                                                (deal) => (
                                                                    <Link
                                                                        key={
                                                                            deal.id
                                                                        }
                                                                        href={route(
                                                                            "deals.show",
                                                                            deal.id,
                                                                        )}
                                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                                                                    >
                                                                        <LinkOutlined className="text-xs" />
                                                                        {
                                                                            deal.name
                                                                        }
                                                                    </Link>
                                                                ),
                                                            )}
                                                        </Space>
                                                    </div>
                                                )}

                                            {/* Leads */}
                                            {task.leads &&
                                                task.leads.length > 0 && (
                                                    <div>
                                                        <Text
                                                            strong
                                                            className="text-gray-600 block mb-2"
                                                        >
                                                            Leads
                                                        </Text>
                                                        <Space wrap>
                                                            {task.leads.map(
                                                                (lead) => (
                                                                    <Link
                                                                        key={
                                                                            lead.id
                                                                        }
                                                                        href={route(
                                                                            "lead-contact.show",
                                                                            lead.id,
                                                                        )}
                                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors"
                                                                    >
                                                                        <UserOutlined className="text-xs" />
                                                                        {
                                                                            lead.client_name
                                                                        }
                                                                        {lead.company_name &&
                                                                            ` (${lead.company_name})`}
                                                                    </Link>
                                                                ),
                                                            )}
                                                        </Space>
                                                    </div>
                                                )}

                                            {/* Properties */}
                                            {task.properties &&
                                                task.properties.length > 0 && (
                                                    <div>
                                                        <Text
                                                            strong
                                                            className="text-gray-600 block mb-2"
                                                        >
                                                            Properties
                                                        </Text>
                                                        <Space wrap>
                                                            {task.properties.map(
                                                                (property) => (
                                                                    <Link
                                                                        key={
                                                                            property.id
                                                                        }
                                                                        href={route(
                                                                            "properties.show",
                                                                            property.id,
                                                                        )}
                                                                        className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                                                                    >
                                                                        <HomeOutlined className="text-xs" />
                                                                        {
                                                                            property.name
                                                                        }
                                                                    </Link>
                                                                ),
                                                            )}
                                                        </Space>
                                                    </div>
                                                )}
                                        </div>
                                    </Card>
                                )}

                                {/* Activity Stats */}
                                <Card className="shadow-sm" variant="outlined">
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
                                                <FileOutlined />
                                                <Text type="secondary">
                                                    Files
                                                </Text>
                                            </div>
                                            <Text strong className="text-2xl">
                                                {task.files_count ||
                                                    task.files?.length ||
                                                    0}
                                            </Text>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
                                                <CommentOutlined />
                                                <Text type="secondary">
                                                    Comments
                                                </Text>
                                            </div>
                                            <Text strong className="text-2xl">
                                                {task.comments_count ||
                                                    task.comments?.length ||
                                                    0}
                                            </Text>
                                        </div>
                                        <div className="p-4 bg-gray-50 rounded-lg">
                                            <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
                                                <UnorderedListOutlined />
                                                <Text type="secondary">
                                                    Notes
                                                </Text>
                                            </div>
                                            <Text strong className="text-2xl">
                                                {task.notes_count || 0}
                                            </Text>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Right Column - Sidebar */}
                            <div className="flex flex-col gap-y-6">
                                {/* Timeline Card */}
                                <Card
                                    title={
                                        <Space>
                                            <CalendarOutlined />
                                            <span>Timeline</span>
                                        </Space>
                                    }
                                    className="shadow-sm"
                                    size="small"
                                    variant="outlined"
                                >
                                    <div className="flex flex-col gap-y-4">
                                        <div>
                                            <Text
                                                type="secondary"
                                                className="text-xs uppercase tracking-wide"
                                            >
                                                Start Date
                                            </Text>
                                            <div className="mt-1">
                                                {task.start_date ? (
                                                    <Text>
                                                        {dayjs(
                                                            task.start_date,
                                                        ).format(
                                                            "MMM DD, YYYY",
                                                        )}
                                                    </Text>
                                                ) : (
                                                    <Text type="secondary">
                                                        Not set
                                                    </Text>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <Text
                                                type="secondary"
                                                className="text-xs uppercase tracking-wide"
                                            >
                                                Due Date
                                            </Text>
                                            <div className="mt-1 flex items-center gap-2">
                                                {task.due_date ? (
                                                    <>
                                                        <Text
                                                            className={
                                                                isOverdue
                                                                    ? "text-red-500"
                                                                    : ""
                                                            }
                                                        >
                                                            {dayjs(
                                                                task.due_date,
                                                            ).format(
                                                                "MMM DD, YYYY",
                                                            )}
                                                        </Text>
                                                        {isOverdue && (
                                                            <Tag color="red">
                                                                Overdue
                                                            </Tag>
                                                        )}
                                                    </>
                                                ) : (
                                                    <Text type="secondary">
                                                        No due date
                                                    </Text>
                                                )}
                                            </div>
                                        </div>
                                        {task.completed_on && (
                                            <div>
                                                <Text
                                                    type="secondary"
                                                    className="text-xs uppercase tracking-wide"
                                                >
                                                    Completed On
                                                </Text>
                                                <div className="mt-1">
                                                    <Text className="text-green-600">
                                                        {dayjs(
                                                            task.completed_on,
                                                        ).format(
                                                            "MMM DD, YYYY",
                                                        )}
                                                    </Text>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                {/* Time Tracking Card */}
                                {(estimatedMinutes > 0 || spentMinutes > 0) && (
                                    <Card
                                        title={
                                            <Space>
                                                <ClockCircleOutlined />
                                                <span>Time Tracking</span>
                                            </Space>
                                        }
                                        className="shadow-sm"
                                        size="small"
                                        variant="outlined"
                                    >
                                        <div className="flex flex-col gap-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Text
                                                        type="secondary"
                                                        className="text-xs uppercase tracking-wide"
                                                    >
                                                        Estimated
                                                    </Text>
                                                    <div className="mt-1">
                                                        <Text strong>
                                                            {estimatedMinutes >
                                                            0
                                                                ? formatDuration(
                                                                      estimatedMinutes,
                                                                  )
                                                                : "—"}
                                                        </Text>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Text
                                                        type="secondary"
                                                        className="text-xs uppercase tracking-wide"
                                                    >
                                                        Spent
                                                    </Text>
                                                    <div className="mt-1">
                                                        <Text strong>
                                                            {spentMinutes > 0
                                                                ? formatDuration(
                                                                      spentMinutes,
                                                                  )
                                                                : "—"}
                                                        </Text>
                                                    </div>
                                                </div>
                                            </div>
                                            {estimatedMinutes > 0 && (
                                                <Progress
                                                    percent={Math.round(
                                                        progressPercent,
                                                    )}
                                                    status={
                                                        progressPercent >= 100
                                                            ? "exception"
                                                            : "active"
                                                    }
                                                    size="small"
                                                />
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {/* Assignees Card */}
                                {task.users && task.users.length > 0 && (
                                    <Card
                                        title={
                                            <Space>
                                                <UserOutlined />
                                                <span>
                                                    Assignees (
                                                    {task.users.length})
                                                </span>
                                            </Space>
                                        }
                                        className="shadow-sm"
                                        size="small"
                                        variant="outlined"
                                    >
                                        <div className="flex flex-col gap-y-3">
                                            {task.users.map((user) => (
                                                <div
                                                    key={user.id}
                                                    className="flex items-center gap-3"
                                                >
                                                    <Avatar
                                                        src={user.image}
                                                        icon={<UserOutlined />}
                                                        size="small"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <Text
                                                            strong
                                                            className="block truncate"
                                                        >
                                                            {user.name}
                                                        </Text>
                                                        {user.designation_name && (
                                                            <Text
                                                                type="secondary"
                                                                className="text-xs block truncate"
                                                            >
                                                                {
                                                                    user.designation_name
                                                                }
                                                            </Text>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}

                                {/* Project Card */}
                                {task.project && (
                                    <Card
                                        title={
                                            <Space>
                                                <ProjectOutlined />
                                                <span>Project</span>
                                            </Space>
                                        }
                                        className="shadow-sm"
                                        size="small"
                                        variant="outlined"
                                    >
                                        <div className="flex items-center gap-2">
                                            <ProjectOutlined className="text-blue-500" />
                                            <Text>
                                                {task.project.project_name}
                                            </Text>
                                            {task.project
                                                .project_short_code && (
                                                <Tag>
                                                    {
                                                        task.project
                                                            .project_short_code
                                                    }
                                                </Tag>
                                            )}
                                        </div>
                                    </Card>
                                )}

                                {/* Category Card */}
                                {task.category && (
                                    <Card
                                        title={
                                            <Space>
                                                <TagOutlined />
                                                <span>Category</span>
                                            </Space>
                                        }
                                        className="shadow-sm"
                                        size="small"
                                        variant="outlined"
                                    >
                                        <Tag>{task.category.category_name}</Tag>
                                    </Card>
                                )}

                                {/* Labels Card */}
                                {task.labels && task.labels.length > 0 && (
                                    <Card
                                        title={
                                            <Space>
                                                <TagOutlined />
                                                <span>Labels</span>
                                            </Space>
                                        }
                                        className="shadow-sm"
                                        size="small"
                                        variant="outlined"
                                    >
                                        <Space wrap>
                                            {task.labels.map((label) => (
                                                <Tag
                                                    key={label.id}
                                                    style={{
                                                        backgroundColor: `${label.label_color}20`,
                                                        borderColor:
                                                            label.label_color,
                                                        color: label.label_color,
                                                    }}
                                                >
                                                    {label.label_name}
                                                </Tag>
                                            ))}
                                        </Space>
                                    </Card>
                                )}

                                {/* Created By Card */}
                                {task.created_by && (
                                    <Card
                                        title="Created By"
                                        className="shadow-sm"
                                        size="small"
                                        variant="outlined"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                src={task.created_by.image}
                                                icon={<UserOutlined />}
                                                size="small"
                                            />
                                            <div>
                                                <Text strong>
                                                    {task.created_by.name}
                                                </Text>
                                                <Text
                                                    type="secondary"
                                                    className="block text-xs"
                                                >
                                                    {dayjs(
                                                        task.created_at,
                                                    ).format(
                                                        "MMM DD, YYYY h:mm A",
                                                    )}
                                                </Text>
                                            </div>
                                        </div>
                                    </Card>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </PageLayout>

            {/* Edit Task Modal */}
            <SaveTaskModal
                open={editModalOpen}
                task={task}
                isDuplicate={false}
                onClose={handleClose}
                categories={categories}
                labels={labels}
                columns={columns}
                users={users}
                projects={projects}
                deals={deals}
                leads={leads}
                properties={properties}
            />

            {/* Duplicate Task Modal */}
            <SaveTaskModal
                open={duplicateModalOpen}
                task={task}
                isDuplicate={true}
                onClose={handleClose}
                categories={categories}
                labels={labels}
                columns={columns}
                users={users}
                projects={projects}
                deals={deals}
                leads={leads}
                properties={properties}
            />

            {/* Delete Task Modal */}
            <DeleteTask
                open={deleteModalOpen}
                task={task}
                onClose={handleDeleteClose}
            />
        </>
    );
};

TaskShow.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default TaskShow;
