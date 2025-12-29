import React from "react";
import {
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
    Button,
    Collapse,
} from "antd";
import {
    ProjectOutlined,
    TagOutlined,
    FileTextOutlined,
    ClockCircleOutlined,
    SaveOutlined,
    UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { usePage } from "@inertiajs/react";

import TaskCategorySelector from "../Components/Selectors/TaskCategorySelector";
import TaskLabelSelector from "../Components/Selectors/TaskLabelSelector";

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

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
    name: string;
}

interface TaskFormProps {
    data?: any;
    visible: boolean;
    onCancel: () => void;
    onSubmit: (values: any) => void;
    submitText: string;
    cancelText: string;
    errors: string[];
    setErrors: (errors: any) => void;
    onErrorsClear: () => void;
    loading: boolean;
    categories: TaskCategory[];
    labels: TaskLabel[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];
    deals?: Deal[];
    leads?: Lead[];
    properties?: Property[];
    relatedEntity?: {
        type: "deal" | "lead" | "property";
        id?: number;
    };
}

const TaskForm: React.FC<TaskFormProps> = ({
    data,
    visible,
    onCancel,
    onSubmit,
    submitText,
    cancelText,
    errors,
    setErrors,
    onErrorsClear,
    loading,
    categories,
    labels,
    columns,
    users,
    projects,
    deals = [],
    leads = [],
    properties = [],
    relatedEntity,
}) => {
    const [form] = Form.useForm();
    const { props } = usePage();
    const permissions = props.permissions as Partial<{
        add_tasks: string;
        edit_tasks: string;
        delete_tasks: string;
        view_tasks: string;
    }>;

    const isAdmin = permissions?.view_tasks === "all";

    console.log(permissions, "this permissions are testable ....");
    console.log(props, "user ....");

    // Set form values when data changes
    React.useEffect(() => {
        if (data && visible) {
            const formValues = {
                ...data,
                start_date: data.start_date ? dayjs(data.start_date) : dayjs(),
                due_date: data.due_date ? dayjs(data.due_date) : undefined,
            };
            form.setFieldsValue(formValues);
        } else if (!data && visible) {
            form.resetFields();
            const initialValues: any = {
                start_date: dayjs(),
                priority: "medium",
                board_column_id: columns.find(
                    (col) => col.slug === "incomplete"
                )?.id,
            };

            // Pre-fill related entity if provided
            if (relatedEntity) {
                if (relatedEntity.type === "deal") {
                    initialValues.deal_id = relatedEntity.id;
                } else if (relatedEntity.type === "lead") {
                    initialValues.lead_id = relatedEntity.id;
                } else if (relatedEntity.type === "property") {
                    initialValues.property_id = relatedEntity.id;
                }
            }

            form.setFieldsValue(initialValues);
        }
    }, [data, visible, form, columns, relatedEntity]);

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={(vals) =>
                onSubmit({
                    ...vals,
                    priority: vals.priority || "medium",
                    without_duedate: !vals.due_date,
                    user_id: isAdmin
                        ? vals?.user_ids
                        : [props?.auth?.user?.id].filter(Boolean), //if not an admin or manager assign to self, TODO: Refactor with the controller in place
                })
            }
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

                    {/* <Col xs={24} sm={12}>
                        <Form.Item name="category_id" label="Category">
                            <TaskCategorySelector placeholder="Select category (optional)" />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item
                            name="task_labels"
                            label="Labels"
                            extra="Add labels to categorize this task"
                        >
                            <TaskLabelSelector placeholder="Select labels" />
                        </Form.Item>
                    </Col> */}
                </Row>
            </Card>

            <Card
                variant="outlined"
                size="small"
                title={
                    <Space>
                        <ClockCircleOutlined />
                        Timelines
                    </Space>
                }
                style={{ marginTop: 16 }}
            >
                <Row gutter={16}>
                    <Col xs={24} sm={12}>
                        <Form.Item
                            name="start_date"
                            label="Start Date"
                            rules={[
                                {
                                    required: false,
                                    message: "Please select start date",
                                },
                            ]}
                        >
                            <DatePicker
                                style={{ width: "100%" }}
                                format="YYYY-MM-DD"
                                placeholder="Select start date"
                            />
                        </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                        <Form.Item
                            name="due_date"
                            label="Due Date"
                            extra="Leave empty if no due date"
                        >
                            <DatePicker
                                style={{ width: "100%" }}
                                format="YYYY-MM-DD"
                                placeholder="Select due date"
                            />
                        </Form.Item>
                    </Col>
                </Row>
            </Card>

            <Collapse style={{ marginTop: 16 }}>
                <Collapse.Panel
                    header={
                        <Space>
                            <ProjectOutlined />
                            Priority & Assignment
                        </Space>
                    }
                    key="project-assignment"
                >
                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="priority"
                                label="Priority"
                                rules={[
                                    {
                                        required: false,
                                        message: "Please select priority",
                                    },
                                ]}
                            >
                                <Select placeholder="Select priority">
                                    <Option value="low">
                                        <Space>🟢 Low Priority</Space>
                                    </Option>
                                    <Option value="medium">
                                        <Space>🔵 Medium Priority</Space>
                                    </Option>
                                    <Option value="high">
                                        <Space>🔴 High Priority</Space>
                                    </Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item
                                name="board_column_id"
                                label="Initial Status"
                                extra="Starting status for this task"
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
                        <Col xs={24} sm={24}>
                            <Form.Item
                                name="deal_id"
                                label="Related Deal"
                                hidden={relatedEntity?.type === "deal"}
                            >
                                <Select
                                    placeholder="Select a deal"
                                    showSearch
                                    allowClear
                                    filterOption={(input, option) =>
                                        (option?.children as unknown as string)
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    disabled={relatedEntity?.type === "deal"}
                                >
                                    {deals.map((deal) => (
                                        <Option key={deal.id} value={deal.id}>
                                            {deal.name}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={24}>
                            <Form.Item
                                name="lead_id"
                                label="Related Lead"
                                hidden={relatedEntity?.type === "lead"}
                            >
                                <Select
                                    placeholder="Select a lead"
                                    showSearch
                                    allowClear
                                    filterOption={(input, option) =>
                                        (option?.children as unknown as string)
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    disabled={relatedEntity?.type === "lead"}
                                >
                                    {leads.map((lead) => (
                                        <Option key={lead.id} value={lead.id}>
                                            {lead.client_name}{" "}
                                            {lead.company_name
                                                ? `(${lead.company_name})`
                                                : ""}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={24}>
                            <Form.Item
                                name="property_id"
                                label="Related Property"
                                hidden={relatedEntity?.type === "property"}
                            >
                                <Select
                                    placeholder="Select a property"
                                    showSearch
                                    allowClear
                                    filterOption={(input, option) =>
                                        (option?.children as unknown as string)
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    disabled={
                                        relatedEntity?.type === "property"
                                    }
                                >
                                    {properties.map((property) => (
                                        <Option
                                            key={property.id}
                                            value={property.id}
                                        >
                                            {property.name}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={24}>
                            <Form.Item
                                name="user_ids"
                                label="Assignees"
                                extra="Select team members to assign this task"
                                hidden={!isAdmin} // THis currecntly only admins and managers can assign tasks, TOODO: Need to implement permission properly and check and enforce on BE ....
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
                                                        style={{
                                                            fontSize: 12,
                                                        }}
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
                </Collapse.Panel>
            </Collapse>

            {/* <Collapse style={{ marginTop: 16 }}>
                <Collapse.Panel
                    header={
                        <Space>
                            <ClockCircleOutlined />
                            Time Estimation & Options
                        </Space>
                    }
                    key="time-options"
                >
                    <Card size="small" bordered={false}>
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
                        </Row>

                        <Divider />

                        <Row gutter={16}>
                            <Col xs={24} sm={8}>
                                <Form.Item
                                    name="is_private"
                                    label="Private Task"
                                    extra="Only assignees can view this task"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Form.Item
                                    name="billable"
                                    label="Billable"
                                    extra="Track time for billing"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                                <Form.Item
                                    name="without_duedate"
                                    label="No Due Date"
                                    extra="Task has no specific deadline"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>
                </Collapse.Panel>
            </Collapse> */}

            <div className="flex items-center justify-end space-x-3 mt-12 mb-4 pt-4 border-t border-gray-200">
                <Button onClick={onCancel} disabled={loading}>
                    {cancelText}
                </Button>
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<SaveOutlined />}
                >
                    {submitText}
                </Button>
            </div>
        </Form>
    );
};

export default TaskForm;
