import React, { useEffect } from "react";
import {
    Modal,
    Form,
    Input,
    Select,
    DatePicker,
    InputNumber,
    Switch,
    Card,
    Row,
    Col,
    Space,
    Typography,
    Tag,
    Divider,
} from "antd";
import {
    EditOutlined,
    CalendarOutlined,
    FlagOutlined,
    UserOutlined,
    ProjectOutlined,
    TagOutlined,
    FileTextOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { companyDateDayjsFormat } from "@/lib/companyDateTime";
import { taskDateTimeToDayjs } from "@/lib/taskDateTime";

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high";
    status: string;
    board_column_id?: number;
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
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
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

interface TaskEditModalProps {
    visible: boolean;
    loading: boolean;
    form: any;
    task: Task | null;
    categories: TaskCategory[];
    labels: TaskLabel[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];
    onCancel: () => void;
    onSubmit: (values: any) => void;
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
    visible,
    loading,
    form,
    task,
    categories,
    labels,
    columns,
    users,
    projects,
    onCancel,
    onSubmit,
}) => {
    // Populate form when task changes
    useEffect(() => {
        if (task && visible) {
            form.setFieldsValue({
                heading: task.heading,
                description: task.description,
                start_date: task.start_date
                    ? taskDateTimeToDayjs(task.start_date)
                    : null,
                due_date: task.due_date
                    ? taskDateTimeToDayjs(task.due_date)
                    : null,
                priority: task.priority,
                project_id: task.project?.id,
                category_id: task.category?.id,
                user_ids: task.users?.map((user) => user.id) || [],
                task_labels: task.labels?.map((label) => label.id) || [],
                board_column_id: task.board_column_id,
                estimate_hours: task.estimate_hours,
                estimate_minutes: task.estimate_minutes,
                is_private: task.is_private,
                billable: task.billable,
            });
        }
    }, [task, visible, form]);

    return (
        <Modal
            title={
                <Space>
                    <EditOutlined />
                    Edit Task
                    {task && <Tag color="blue">ID: {task.id}</Tag>}
                </Space>
            }
            open={visible}
            onCancel={onCancel}
            onOk={() => form.submit()}
            width={800}
            confirmLoading={loading}
            destroyOnClose
            okText="Update Task"
            cancelText="Cancel"
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={onSubmit}
                preserve={false}
                style={{ marginTop: 16 }}
            >
                <Card
                    size="small"
                    title={
                        <Space>
                            <FileTextOutlined />
                            Task Details
                        </Space>
                    }
                    variant="outlined"
                >
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="heading"
                                label="Task Title"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please enter task title",
                                    },
                                    {
                                        min: 3,
                                        message:
                                            "Title must be at least 3 characters",
                                    },
                                ]}
                            >
                                <Input
                                    placeholder="Enter task title..."
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item
                                name="description"
                                label="Description"
                                extra="Provide a detailed description of the task"
                            >
                                <TextArea
                                    rows={4}
                                    placeholder="Enter task description..."
                                    showCount
                                    maxLength={1000}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card
                    size="small"
                    title={
                        <Space>
                            <ProjectOutlined />
                            Project & Assignment
                        </Space>
                    }
                    style={{ marginTop: 16 }}
                    variant="outlined"
                >
                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="project_id" label="Project">
                                <Select
                                    placeholder="Select project (optional)"
                                    allowClear
                                    showSearch
                                    filterOption={(input, option) =>
                                        option?.children
                                            ?.toString()
                                            .toLowerCase()
                                            .includes(input.toLowerCase()) ??
                                        false
                                    }
                                >
                                    {projects.map((project) => (
                                        <Option
                                            key={project.id}
                                            value={project.id}
                                        >
                                            <Space>
                                                <ProjectOutlined />
                                                {project.project_name}
                                                {project.project_short_code && (
                                                    <Tag>
                                                        {
                                                            project.project_short_code
                                                        }
                                                    </Tag>
                                                )}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="user_ids"
                                label="Assignees"
                                extra="Select team members to assign this task"
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Select assignees"
                                    showSearch
                                    filterOption={(input, option) =>
                                        option?.children
                                            ?.toString()
                                            .toLowerCase()
                                            .includes(input.toLowerCase()) ??
                                        false
                                    }
                                >
                                    {users.map((user) => (
                                        <Option key={user.id} value={user.id}>
                                            <Space>
                                                <UserOutlined />
                                                {user.name}
                                                {user.designation_name && (
                                                    <Text
                                                        type="secondary"
                                                        style={{ fontSize: 12 }}
                                                    >
                                                        ({user.designation_name}
                                                        )
                                                    </Text>
                                                )}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card
                    size="small"
                    title={
                        <Space>
                            <CalendarOutlined />
                            Timeline & Priority
                        </Space>
                    }
                    style={{ marginTop: 16 }}
                    variant="outlined"
                >
                    <Row gutter={16}>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="start_date"
                                label="Start Date"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select start date",
                                    },
                                ]}
                            >
                                <DatePicker
                                    style={{ width: "100%" }}
                                    format={companyDateDayjsFormat()}
                                    placeholder="Select start date"
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="due_date"
                                label="Due Date"
                                extra="Leave empty if no due date"
                            >
                                <DatePicker
                                    style={{ width: "100%" }}
                                    format={companyDateDayjsFormat()}
                                    placeholder="Select due date"
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="priority"
                                label="Priority"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select priority",
                                    },
                                ]}
                            >
                                <Select placeholder="Select priority">
                                    <Option value="low">
                                        <Space>🟢 Low Priority</Space>
                                    </Option>
                                    <Option value="medium">
                                        <Space>🟡 Medium Priority</Space>
                                    </Option>
                                    <Option value="high">
                                        <Space>🔴 High Priority</Space>
                                    </Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card
                    size="small"
                    title={
                        <Space>
                            <TagOutlined />
                            Status & Categories
                        </Space>
                    }
                    style={{ marginTop: 16 }}
                    variant="outlined"
                >
                    <Row gutter={16}>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="board_column_id"
                                label="Status"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select status",
                                    },
                                ]}
                            >
                                <Select placeholder="Select status">
                                    {columns.map((column) => (
                                        <Option
                                            key={column.id}
                                            value={column.id}
                                        >
                                            <Space>
                                                <div
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: "50%",
                                                        backgroundColor:
                                                            column.label_color,
                                                        display: "inline-block",
                                                    }}
                                                />
                                                {column.column_name}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item name="category_id" label="Category">
                                <Select
                                    placeholder="Select category (optional)"
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
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="task_labels"
                                label="Labels"
                                extra="Add labels to categorize this task"
                            >
                                <Select
                                    mode="multiple"
                                    placeholder="Select labels"
                                >
                                    {labels.map((label) => (
                                        <Option key={label.id} value={label.id}>
                                            <Space>
                                                <div
                                                    style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: "50%",
                                                        backgroundColor:
                                                            label.label_color,
                                                        display: "inline-block",
                                                    }}
                                                />
                                                {label.label_name}
                                            </Space>
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card
                    size="small"
                    title={
                        <Space>
                            <ClockCircleOutlined />
                            Time Estimation & Options
                        </Space>
                    }
                    style={{ marginTop: 16 }}
                    variant="outlined"
                >
                    <Row gutter={16}>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="estimate_hours"
                                label="Estimated Hours"
                                extra="How many hours will this take?"
                            >
                                <InputNumber
                                    min={0}
                                    max={999}
                                    placeholder="0"
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="estimate_minutes"
                                label="Estimated Minutes"
                                extra="Additional minutes (0-59)"
                            >
                                <InputNumber
                                    min={0}
                                    max={59}
                                    placeholder="0"
                                    style={{ width: "100%" }}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                }}
                            >
                                <Form.Item
                                    name="is_private"
                                    label="Private Task"
                                    extra="Only assignees can view"
                                    valuePropName="checked"
                                    style={{ marginBottom: 8 }}
                                >
                                    <Switch size="small" />
                                </Form.Item>
                                <Form.Item
                                    name="billable"
                                    label="Billable"
                                    extra="Track time for billing"
                                    valuePropName="checked"
                                    style={{ marginBottom: 0 }}
                                >
                                    <Switch size="small" />
                                </Form.Item>
                            </div>
                        </Col>
                    </Row>
                </Card>
            </Form>
        </Modal>
    );
};
