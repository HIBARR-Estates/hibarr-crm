import React from "react";
import {
    Card,
    Descriptions,
    Avatar,
    Tag,
    Space,
    Progress,
    Typography,
    Row,
    Col,
    Divider,
    List,
    Tooltip,
    Empty,
    Skeleton,
} from "antd";
import {
    CalendarOutlined,
    UserOutlined,
    FlagOutlined,
    ClockCircleOutlined,
    ProjectOutlined,
    FileTextOutlined,
    TagOutlined,
    EyeOutlined,
    LockOutlined,
    DollarOutlined,
    LinkOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getStatusColor } from "@/lib/utils";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { Link } from "@inertiajs/react";

const { Text, Title } = Typography;

// Match the Task interface from columns
export interface Task {
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
        designation_name?: string;
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
    created_at?: string;
    updated_at?: string;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    task_short_code?: string;
    board_column?: {
        id: number;
        column_name: string;
        slug: string;
        label_color: string;
    };
    time_logs?: Array<{
        total_minutes: number;
    }>;
    created_by?: {
        id: number;
        name: string;
        image?: string;
    };
    assigner?: {
        id: number;
        name: string;
        image?: string;
    };
    hash?: string;
    deals?: Array<{
        id: number;
        name: string;
    }>;
    leads?: Array<{
        id: number;
        client_name: string;
        company_name?: string;
    }>;
    properties?: Array<{
        id: number;
        name: string;
    }>;
}

interface TaskDetailsDrawerProps {
    task: Task | null | undefined;
    loading: boolean;
    td?: (key: string) => string;
}

const TaskDetailsDrawer: React.FC<TaskDetailsDrawerProps> = ({
    task: initialTask,
    loading: initialLoading,
    td = (key) => key,
}) => {
    // Fetch full task details
    const { data: fetchedTaskData, isLoading: isFetchingTask } = useApiQuery<{
        task: Task;
    }>({
        path: initialTask?.id ? route("tasks.data", initialTask.id) : "",
        options: {
            enabled: !!initialTask?.id,
        },
    });

    const task = fetchedTaskData?.task || initialTask;
    const loading = initialLoading || isFetchingTask;

    if (loading) {
        return (
            <div style={{ padding: "24px", textAlign: "center" }}>
                <Skeleton active paragraph={{ rows: 10 }} />
            </div>
        );
    }

    if (!task) {
        return (
            <Empty description="Task not found" style={{ margin: "40px 0" }} />
        );
    }

    // Priority configuration matching table columns
    const priorityConfig = {
        low: { color: "#52c41a", icon: "🟢", bg: "#f6ffed" },
        medium: { color: "#1890ff", icon: "🔵", bg: "#e6f7ff" },
        high: { color: "#ff4d4f", icon: "🔴", bg: "#fff1f0" },
    };

    const getPriorityColor = (priority: string) => {
        return (
            priorityConfig[priority as keyof typeof priorityConfig]?.color ||
            "default"
        );
    };

    const getPriorityIcon = (priority: string) => {
        return (
            priorityConfig[priority as keyof typeof priorityConfig]?.icon ||
            "⚪"
        );
    };

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

    return (
        <div style={{ padding: "0" }}>
            {/* Header Section */}
            <Card size="small" style={{ marginBottom: 16 }} variant="outlined">
                <div style={{ marginBottom: 16 }}>
                    <Space
                        direction="vertical"
                        size="small"
                        style={{ width: "100%" }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                            }}
                        >
                            <Space>
                                <FileTextOutlined
                                    style={{ color: "#1890ff" }}
                                />
                                {task.task_short_code && (
                                    <Text strong style={{ fontSize: "16px" }}>
                                        #{task.task_short_code}
                                    </Text>
                                )}
                            </Space>
                            <Space>
                                {Boolean(task.is_private) && (
                                    <Tooltip title={td("Private Task")}>
                                        <LockOutlined
                                            style={{ color: "#fa8c16" }}
                                        />
                                    </Tooltip>
                                )}
                                {Boolean(task.billable) && (
                                    <Tooltip title={td("Billable")}>
                                        <DollarOutlined
                                            style={{ color: "#52c41a" }}
                                        />
                                    </Tooltip>
                                )}
                                <EyeOutlined style={{ color: "#722ed1" }} />
                            </Space>
                        </div>
                        <Title
                            level={4}
                            style={{ margin: 0, wordBreak: "break-word" }}
                        >
                            {task.heading}
                        </Title>

                        <Text
                            type="secondary"
                            style={{
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                            }}
                        >
                            {task?.description ??
                                "No Description has been assigned to this task"}
                        </Text>
                    </Space>
                </div>
            </Card>

            {/* Priority and Status */}
            <Card
                size="small"
                title="Status & Priority"
                style={{ marginBottom: 16 }}
                variant="outlined"
            >
                <Row gutter={16}>
                    <Col span={12}>
                        <Space direction="vertical" size="small">
                            <Text strong>Priority</Text>
                            <Tag
                                color={getPriorityColor(task.priority)}
                                icon={<FlagOutlined />}
                                className="uppercase"
                            >
                                {task.priority.toUpperCase()}
                            </Tag>
                        </Space>
                    </Col>
                    <Col span={12}>
                        <Space direction="vertical" size="small">
                            <Text strong>{td("Status")}</Text>
                            <Tag
                                color={getStatusColor(task.status)}
                                className="capitalize"
                            >
                                {task.board_column?.column_name ||
                                    task.status ||
                                    "Unknown"}
                            </Tag>
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Timeline */}
            <Card
                size="small"
                title={
                    <Space>
                        <CalendarOutlined />
                        {td("Timeline")}
                    </Space>
                }
                style={{ marginBottom: 16 }}
                variant="outlined"
            >
                <Descriptions size="small" column={1}>
                    <Descriptions.Item label={td("Start Date")}>
                        {task.start_date
                            ? dayjs(task.start_date).format(
                                  "MMM DD, YYYY h:mm A",
                              )
                            : "Not set"}
                    </Descriptions.Item>
                    <Descriptions.Item label={td("Due Date")}>
                        {task.due_date ? (
                            <Space>
                                {dayjs(task.due_date).format(
                                    "MMM DD, YYYY h:mm A",
                                )}
                                {dayjs().isAfter(dayjs(task.due_date)) && (
                                    <Tag color="red">Overdue</Tag>
                                )}
                            </Space>
                        ) : (
                            "No due date"
                        )}
                    </Descriptions.Item>
                    {(task.created_at || task.updated_at) && (
                        <>
                            {task.created_at && (
                                <Descriptions.Item label={td("Created")}>
                                    {dayjs(task.created_at).format(
                                        "MMM DD, YYYY HH:mm",
                                    )}
                                </Descriptions.Item>
                            )}
                            {task.updated_at && (
                                <Descriptions.Item label={td("Last Updated")}>
                                    {dayjs(task.updated_at).format(
                                        "MMM DD, YYYY HH:mm",
                                    )}
                                </Descriptions.Item>
                            )}
                        </>
                    )}
                </Descriptions>
            </Card>

            {/* Time Tracking */}
            {(estimatedMinutes > 0 || spentMinutes > 0) && (
                <Card
                    size="small"
                    title={
                        <Space>
                            <ClockCircleOutlined />
                            {td("Time Tracking")}
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                    variant="outlined"
                >
                    <Space direction="vertical" style={{ width: "100%" }}>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Text strong>{td("Estimated")}</Text>
                                <br />
                                <Text>
                                    {estimatedMinutes > 0
                                        ? formatDuration(estimatedMinutes)
                                        : "Not set"}
                                </Text>
                            </Col>
                            <Col span={12}>
                                <Text strong>{td("Time Spent")}</Text>
                                <br />
                                <Text>
                                    {spentMinutes > 0
                                        ? formatDuration(spentMinutes)
                                        : "No time logged"}
                                </Text>
                            </Col>
                        </Row>
                        {estimatedMinutes > 0 && (
                            <>
                                <Divider />
                                <div>
                                    <Text strong>{td("Progress")}</Text>
                                    <Progress
                                        percent={Math.round(progressPercent)}
                                        status={
                                            progressPercent >= 100
                                                ? "exception"
                                                : "active"
                                        }
                                        format={(percent) => `${percent}%`}
                                    />
                                </div>
                            </>
                        )}
                    </Space>
                </Card>
            )}

            {/* Project & Assignment */}
            {(task.project ||
                task.assigner ||
                task.created_by ||
                (task.users && task.users.length > 0)) && (
                <Card
                    size="small"
                    title={
                        <Space>
                            <ProjectOutlined />
                            {td("Project & Assignment")}
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                    variant="outlined"
                >
                    {task.project && (
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>{td("Project")}</Text>
                            <br />
                            <Space>
                                <ProjectOutlined />
                                <Text>{task.project.project_name}</Text>
                                {task.project.project_short_code && (
                                    <Tag>{task.project.project_short_code}</Tag>
                                )}
                            </Space>
                        </div>
                    )}

                    {(task.assigner ?? task.created_by) && (
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>{td("Assigner")}</Text>
                            <br />
                            <Space style={{ marginTop: 8 }}>
                                <Avatar
                                    size="small"
                                    icon={<UserOutlined />}
                                    src={
                                        (task.assigner ?? task.created_by)
                                            ?.image
                                    }
                                />
                                <Text>
                                    {(task.assigner ?? task.created_by)?.name}
                                </Text>
                            </Space>
                        </div>
                    )}

                    {task.users && task.users.length > 0 && (
                        <div>
                            <Text strong>
                                {td("Assignees")} ({task.users.length})
                            </Text>
                            <List
                                size="small"
                                style={{ marginTop: 8 }}
                                dataSource={task.users}
                                renderItem={(user: any) => (
                                    <List.Item
                                        style={{
                                            padding: "8px 0",
                                            border: "none",
                                        }}
                                    >
                                        <Space>
                                            <Avatar
                                                size="small"
                                                icon={<UserOutlined />}
                                                src={user.image}
                                            />
                                            <div>
                                                <Text strong>{user.name}</Text>
                                                {user.designation_name && (
                                                    <Text
                                                        type="secondary"
                                                        style={{
                                                            display: "block",
                                                            fontSize: "12px",
                                                        }}
                                                    >
                                                        {td(
                                                            user.designation_name,
                                                        )}
                                                    </Text>
                                                )}
                                            </div>
                                        </Space>
                                    </List.Item>
                                )}
                            />
                        </div>
                    )}
                </Card>
            )}

            {/* Categories & Labels */}
            {(task.category || (task.labels && task.labels.length > 0)) && (
                <Card
                    size="small"
                    title={
                        <Space>
                            <TagOutlined />
                            {td("Categories & Labels")}
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                    variant="outlined"
                >
                    {task.category && (
                        <div
                            style={{
                                marginBottom:
                                    (task?.labels || [])?.length > 0 ? 16 : 0,
                            }}
                        >
                            <Text strong>{td("Category")}</Text>
                            <br />
                            <Tag>{td(task.category.category_name)}</Tag>
                        </div>
                    )}

                    {task.labels && task.labels.length > 0 && (
                        <div>
                            <Text strong>{td("Labels")}</Text>
                            <br />
                            <Space wrap style={{ marginTop: 4 }}>
                                {task.labels.slice(0, 2).map((label: any) => (
                                    <Tag
                                        key={label.id}
                                        color={label.label_color}
                                        style={{
                                            backgroundColor: label.label_color,
                                            borderColor: label.label_color,
                                            color: "#fff",
                                        }}
                                    >
                                        {td(label.label_name)}
                                    </Tag>
                                ))}
                                {task.labels.length > 2 && (
                                    <Tooltip
                                        title={task.labels
                                            .slice(2)
                                            .map((l: any) => td(l.label_name))
                                            .join(", ")}
                                    >
                                        <Tag>+{task.labels.length - 2}</Tag>
                                    </Tooltip>
                                )}
                            </Space>
                        </div>
                    )}
                </Card>
            )}

            {/* Related Entities - Properties, Deals, Leads */}
            {((task.deals && task.deals.length > 0) ||
                (task.leads && task.leads.length > 0) ||
                (task.properties && task.properties.length > 0)) && (
                <Card
                    size="small"
                    title={
                        <Space>
                            <FlagOutlined />
                            {td("Related Entities")}
                        </Space>
                    }
                    style={{ marginBottom: 16 }}
                    variant="outlined"
                >
                    {/* Deals */}
                    {task.deals && task.deals.length > 0 && (
                        <div
                            style={{
                                marginBottom:
                                    (task.leads?.length || 0) > 0 ||
                                    (task.properties?.length || 0) > 0
                                        ? 16
                                        : 0,
                            }}
                        >
                            <Text strong>{td("Deals")}</Text>
                            <List
                                size="small"
                                dataSource={task.deals}
                                renderItem={(deal: any) => (
                                    <List.Item style={{ padding: "4px 0" }}>
                                        <Link
                                            href={route("deals.show", deal.id)}
                                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                        >
                                            <LinkOutlined
                                                style={{ fontSize: 12 }}
                                            />
                                            {td(deal.name)}
                                        </Link>
                                    </List.Item>
                                )}
                            />
                        </div>
                    )}
                    {/* Leads */}
                    {task.leads && task.leads.length > 0 && (
                        <div
                            style={{
                                marginBottom:
                                    (task.properties?.length || 0) > 0 ? 16 : 0,
                            }}
                        >
                            <Text strong>{td("Leads")}</Text>
                            <List
                                size="small"
                                dataSource={task.leads}
                                renderItem={(lead: any) => (
                                    <List.Item style={{ padding: "4px 0" }}>
                                        <Link
                                            href={route(
                                                "lead-contact.show",
                                                lead.id,
                                            )}
                                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                        >
                                            <LinkOutlined
                                                style={{ fontSize: 12 }}
                                            />
                                            {lead.client_name}{" "}
                                            {lead.company_name
                                                ? `(${lead.company_name})`
                                                : ""}
                                        </Link>
                                    </List.Item>
                                )}
                            />
                        </div>
                    )}
                    {/* Properties */}
                    {task.properties && task.properties.length > 0 && (
                        <div>
                            <Text strong>{td("Properties")}</Text>
                            <List
                                size="small"
                                dataSource={task.properties}
                                renderItem={(property: any) => (
                                    <List.Item style={{ padding: "4px 0" }}>
                                        <Link
                                            href={route(
                                                "products.show",
                                                property.id,
                                            )}
                                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                        >
                                            <LinkOutlined
                                                style={{ fontSize: 12 }}
                                            />
                                            {td(property.name)}
                                        </Link>
                                    </List.Item>
                                )}
                            />
                        </div>
                    )}
                </Card>
            )}

            {/* Additional Details */}
            {/* {(task.task_short_code || task.hash) && (
                <Card
                    size="small"
                    title="Additional Details"
                    style={{ marginBottom: 16 }}
                >
                    <Descriptions size="small" column={1}>
                        {task.task_short_code && (
                            <Descriptions.Item label="Task Code">
                                <Text code>{task.task_short_code}</Text>
                            </Descriptions.Item>
                        )}
                        {task.hash && (
                            <Descriptions.Item label="Unique Hash">
                                <Text code style={{ fontSize: "11px" }}>
                                    {task.hash}
                                </Text>
                            </Descriptions.Item>
                        )}
                        {task.created_by && (
                            <Descriptions.Item label="Created By">
                                <Space>
                                    <Avatar
                                        size="small"
                                        icon={<UserOutlined />}
                                        src={task.created_by.image}
                                    />
                                    {task.created_by.name}
                                </Space>
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                </Card>
            )} */}
        </div>
    );
};

export default TaskDetailsDrawer;
