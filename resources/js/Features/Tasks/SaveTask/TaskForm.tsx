import React from "react";
import {
    Form,
    Input,
    Select,
    DatePicker,
    InputNumber,
    Switch,
    Row,
    Col,
    Space,
    Typography,
    Tag,
    Divider,
    Button,
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
    td?: (key: string) => string;
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
    td = (key) => key,
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
                board_column_id: columns.find((col) => col.slug === "to_do")
                    ?.id,
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
            onFinish={(vals) => {
                const taskableInfo: any = {};

                if (vals.deal_id) {
                    taskableInfo.taskable_type = "deal";
                    taskableInfo.taskable_id = vals.deal_id;
                } else if (vals.lead_id) {
                    taskableInfo.taskable_type = "lead";
                    taskableInfo.taskable_id = vals.lead_id;
                } else if (vals.property_id) {
                    taskableInfo.taskable_type = "property";
                    taskableInfo.taskable_id = vals.property_id;
                }

                onSubmit({
                    ...vals,
                    ...taskableInfo,
                    priority: vals.priority || "medium",
                    without_duedate: !vals.due_date,
                    user_ids: isAdmin
                        ? vals?.user_ids
                        : [props?.auth?.user?.id].filter(Boolean),
                });
            }}
            preserve={false}
            style={{ marginTop: 16 }}
        >
            <Row gutter={16}>
                <Col span={24}>
                    <Form.Item
                        name="heading"
                        label={td("Task Title")}
                        rules={[
                            {
                                required: true,
                                message: td("Please enter task title"),
                            },
                            {
                                min: 3,
                                message: td(
                                    "Title must be at least 3 characters",
                                ),
                            },
                        ]}
                    >
                        <Input
                            placeholder={td("Enter task title...")}
                            size="large"
                        />
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item
                        name="description"
                        label={td("Description")}
                        extra={td("Provide a detailed description of the task")}
                    >
                        <TextArea
                            rows={4}
                            placeholder={td("Enter task description...")}
                            showCount
                            maxLength={1000}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                    <Form.Item
                        name="start_date"
                        label={td("Start Date")}
                        rules={[
                            {
                                required: false,
                                message: "Please select start date",
                            },
                        ]}
                    >
                        <DatePicker
                            style={{ width: "100%" }}
                            showTime={{ format: "HH:mm" }}
                            placeholder="Select start date"
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                    <Form.Item
                        name="due_date"
                        label={td("Due Date")}
                        extra={td("Leave empty if no due date")}
                    >
                        <DatePicker
                            style={{ width: "100%" }}
                            showTime={{ format: "HH:mm" }}
                            placeholder={td("Select due date")}
                        />
                    </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                    <Form.Item
                        name="priority"
                        label={td("Priority")}
                        rules={[
                            {
                                required: false,
                                message: td("Please select priority"),
                            },
                        ]}
                    >
                        <Select placeholder={td("Select priority")}>
                            <Option value="low">
                                <Space>🟢 {td("Low Priority")}</Space>
                            </Option>
                            <Option value="medium">
                                <Space>🔵 {td("Medium Priority")}</Space>
                            </Option>
                            <Option value="high">
                                <Space>🔴 {td("High Priority")}</Space>
                            </Option>
                        </Select>
                    </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                    <Form.Item
                        name="board_column_id"
                        label={td("Initial Status")}
                        extra={td("Starting status for this task")}
                    >
                        <Select>
                            {columns.map((column) => (
                                <Option key={column.id} value={column.id}>
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
                        name="user_ids"
                        label={td("Assignees")}
                        extra={td("Select team members to assign this task")}
                    >
                        <Select
                            mode="multiple"
                            placeholder={td("Select assignees")}
                            showSearch
                            filterOption={(input, option) => {
                                const user = users.find(
                                    (u) => u.id === option?.value,
                                );
                                return (
                                    user?.name
                                        ?.toLowerCase()
                                        .includes(input.toLowerCase()) ||
                                    user?.designation_name
                                        ?.toLowerCase()
                                        .includes(input.toLowerCase()) ||
                                    false
                                );
                            }}
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
                                                ({td(user.designation_name)})
                                            </Text>
                                        )}
                                    </Space>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                {relatedEntity?.type !== "deal" && deals.length > 0 && (
                    <Col xs={24} sm={24}>
                        <Form.Item name="deal_id" label={td("Related Deal")}>
                            <Select
                                placeholder={td("Select a deal")}
                                showSearch
                                allowClear
                                filterOption={(input, option) =>
                                    (option?.children as unknown as string)
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                            >
                                {deals.map((deal) => (
                                    <Option key={deal.id} value={deal.id}>
                                        {td(deal.name)}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                )}

                {relatedEntity?.type !== "lead" && leads.length > 0 && (
                    <Col xs={24} sm={24}>
                        <Form.Item name="lead_id" label={td("Related Lead")}>
                            <Select
                                placeholder={td("Select a lead")}
                                showSearch
                                allowClear
                                filterOption={(input, option) =>
                                    (option?.children as unknown as string)
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
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
                )}

                {relatedEntity?.type !== "property" &&
                    properties.length > 0 && (
                        <Col xs={24} sm={24}>
                            <Form.Item
                                name="property_id"
                                label={td("Related Property")}
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
                    )}
            </Row>

            <div className="flex items-center justify-end space-x-3 mt-8 pt-4 border-t border-gray-200">
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
