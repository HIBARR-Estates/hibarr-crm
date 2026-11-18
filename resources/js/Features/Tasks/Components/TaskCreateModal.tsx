import React from "react";
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
    Drawer,
    Button,
    Collapse,
} from "antd";
import {
    PlusOutlined,
    CalendarOutlined,
    FlagOutlined,
    UserOutlined,
    ProjectOutlined,
    TagOutlined,
    FileTextOutlined,
    ClockCircleOutlined,
    SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { companyDateDayjsFormat } from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

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

interface TaskCreateModalProps {
    visible: boolean;
    loading: boolean;
    form: any;
    categories: TaskCategory[];
    labels: TaskLabel[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];
    onCancel: () => void;
    onSubmit: (values: any) => void;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
    visible,
    loading,
    form,
    categories,
    labels,
    columns,
    users,
    projects,
    onCancel,
    onSubmit,
}) => {
    const { td } = useTd();
    return (
        <Drawer
            title={<Space>{td("Create New Task", { source: "en" })}</Space>}
            size="large"
            open={visible}
            onClose={onCancel}
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
                >
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                name="heading"
                                label={td("Task Title", { source: "en" })}
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
                                    placeholder={td("Enter task title...", { source: "en" })}
                                    size="large"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item
                                name="description"
                                label={td("Description", { source: "en" })}
                                extra="Provide a detailed description of the task"
                            >
                                <TextArea
                                    rows={4}
                                    placeholder={td("Enter task description...", { source: "en" })}
                                    showCount
                                    maxLength={1000}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="start_date"
                                label={td("Start Date", { source: "en" })}
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select start date",
                                    },
                                ]}
                                initialValue={dayjs()}
                            >
                                <DatePicker
                                    style={{ width: "100%" }}
                                    format={companyDateDayjsFormat()}
                                    placeholder={td("Select start date", { source: "en" })}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="due_date"
                                label={td("Due Date", { source: "en" })}
                                extra="Leave empty if no due date"
                            >
                                <DatePicker
                                    style={{ width: "100%" }}
                                    format={companyDateDayjsFormat()}
                                    placeholder={td("Select due date", { source: "en" })}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Form.Item
                                name="priority"
                                label={td("Priority", { source: "en" })}
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select priority",
                                    },
                                ]}
                                initialValue="medium"
                            >
                                <Select placeholder={td("Select priority", { source: "en" })}>
                                    <Option value="low">
                                        <Space>{td("🟢 Low Priority", { source: "en" })}</Space>
                                    </Option>
                                    <Option value="medium">
                                        <Space>{td("🟡 Medium Priority", { source: "en" })}</Space>
                                    </Option>
                                    <Option value="high">
                                        <Space>{td("🔴 High Priority", { source: "en" })}</Space>
                                    </Option>
                                    <Option value="highest">
                                        <Space>{td("🔴 Highest Priority", { source: "en" })}</Space>
                                    </Option>
                                    <Option value="urgent">
                                        <Space>{td("🔴 Urgent Priority", { source: "en" })}</Space>
                                    </Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Collapse style={{ marginTop: 16 }}>
                    <Collapse.Panel
                        header={
                            <Space>
                                <ProjectOutlined />
                                Project & Assignment
                            </Space>
                        }
                        key="project-assignment"
                    >
                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item name="project_id" label={td("Project", { source: "en" })}>
                                    <Select
                                        placeholder={td("Select project (optional)", { source: "en" })}
                                        allowClear
                                        showSearch
                                        filterOption={(input, option) =>
                                            option?.children
                                                ?.toString()
                                                .toLowerCase()
                                                .includes(
                                                    input.toLowerCase(),
                                                ) ?? false
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
                                    label={td("Assignees", { source: "en" })}
                                    extra="Select team members to assign this task"
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder={td("Select assignees", { source: "en" })}
                                        showSearch
                                        filterOption={(input, option) =>
                                            option?.children
                                                ?.toString()
                                                .toLowerCase()
                                                .includes(
                                                    input.toLowerCase(),
                                                ) ?? false
                                        }
                                    >
                                        {users.map((user) => (
                                            <Option
                                                key={user.id}
                                                value={user.id}
                                            >
                                                <Space>
                                                    <UserOutlined />
                                                    {user.name}
                                                    {user.designation_name && (
                                                        <Text
                                                            type="secondary"
                                                            style={{
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            (
                                                            {
                                                                user.designation_name
                                                            }
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
                    </Collapse.Panel>
                </Collapse>

                <Collapse style={{ marginTop: 16 }}>
                    <Collapse.Panel
                        header={
                            <Space>
                                <TagOutlined />
                                Categories & Labels
                            </Space>
                        }
                        key="categories-labels"
                    >
                        <Row gutter={16}>
                            <Col xs={24} sm={12}>
                                <Form.Item name="category_id" label={td("Category", { source: "en" })}>
                                    <Select
                                        placeholder={td("Select category (optional)", { source: "en" })}
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
                            <Col xs={24} sm={12}>
                                <Form.Item
                                    name="task_labels"
                                    label={td("Labels", { source: "en" })}
                                    extra="Add labels to categorize this task"
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder={td("Select labels", { source: "en" })}
                                    >
                                        {labels.map((label) => (
                                            <Option
                                                key={label.id}
                                                value={label.id}
                                            >
                                                <Space>
                                                    <div
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: "50%",
                                                            backgroundColor:
                                                                label.label_color,
                                                            display:
                                                                "inline-block",
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
                    </Collapse.Panel>
                </Collapse>

                <Collapse style={{ marginTop: 16 }}>
                    <Collapse.Panel
                        header={
                            <Space>
                                <ClockCircleOutlined />
                                Time Estimation & Options
                            </Space>
                        }
                        key="time-options"
                    >
                        <Row gutter={16}>
                            <Col xs={24} sm={8}>
                                <Form.Item
                                    name="estimate_hours"
                                    label={td("Estimated Hours", { source: "en" })}
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
                                    label={td("Estimated Minutes", { source: "en" })}
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
                                <Form.Item
                                    name="board_column_id"
                                    label={td("Initial Status", { source: "en" })}
                                    extra="Starting status for this task"
                                    initialValue={
                                        columns.find(
                                            (col) => col.slug === "to_do",
                                        )?.id
                                    }
                                >
                                    <Select>
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
                                                            display:
                                                                "inline-block",
                                                        }}
                                                    />
                                                    {column.column_name}
                                                </Space>
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>

                        <Divider />

                        <Row gutter={16}>
                            <Col xs={24} sm={8}>
                                <Form.Item
                                    name="is_private"
                                    label={td("Private Task", { source: "en" })}
                                    extra="Only assignees can view this task"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Form.Item
                                    name="billable"
                                    label={td("Billable", { source: "en" })}
                                    extra="Track time for billing"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Form.Item
                                    name="without_duedate"
                                    label={td("No Due Date", { source: "en" })}
                                    extra="Task has no specific deadline"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Collapse.Panel>
                </Collapse>

                <div className="flex items-center justify-end space-x-3 mt-12 mb-4 pt-4 border-t border-gray-200">
                    <Button onClick={onCancel} disabled={loading}>
                        {td("Cancel", { source: "en" })}
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        icon={<SaveOutlined />}
                    >
                        {`Submit`}
                    </Button>
                </div>
            </Form>
        </Drawer>
    );
};
