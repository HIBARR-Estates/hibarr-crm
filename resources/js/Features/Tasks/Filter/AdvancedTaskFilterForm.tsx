import React from "react";
import { Form, Select, DatePicker, Button, Space, Row, Col, Card } from "antd";
import { SearchOutlined, ClearOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { companyDateDayjsFormat } from "@/lib/companyDateTime";

const { Option } = Select;
const { RangePicker } = DatePicker;

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

interface AdvancedTaskFilterFormProps {
    filters: any;
    onFilterChange: (key: string, value: any) => void;
    categories?: TaskCategory[];
    labels?: TaskLabel[];
    columns?: TaskboardColumn[];
    users?: User[];
    projects?: Project[];
}

const AdvancedTaskFilterForm: React.FC<AdvancedTaskFilterFormProps> = ({
    filters,
    onFilterChange,
    categories = [],
    labels = [],
    columns = [],
    users = [],
    projects = [],
}) => {
    const [form] = Form.useForm();

    const handleFormChange = (changedFields: any, allFields: any) => {
        Object.keys(changedFields).forEach((key) => {
            let value = changedFields[key];

            // Handle date range picker
            if (key === "due_date_range" && value) {
                value = [
                    value[0]?.format("YYYY-MM-DD"),
                    value[1]?.format("YYYY-MM-DD"),
                ];
            }

            onFilterChange(key, value);
        });
    };

    const handleReset = () => {
        form.resetFields();
        // Reset all filters
        Object.keys(filters).forEach((key) => {
            onFilterChange(key, undefined);
        });
    };

    // Set initial values
    React.useEffect(() => {
        const initialValues = { ...filters };

        // Convert date strings back to dayjs objects for the form
        if (filters.due_date_range && Array.isArray(filters.due_date_range)) {
            initialValues.due_date_range = [
                dayjs(filters.due_date_range[0]),
                dayjs(filters.due_date_range[1]),
            ];
        }

        form.setFieldsValue(initialValues);
    }, [filters, form]);

    return (
        <Form
            form={form}
            layout="vertical"
            onValuesChange={handleFormChange}
            className="space-y-4"
        >
            <Card size="small" title="Task Filters" className="mb-4">
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={12}>
                        <Form.Item name="status" label="Status">
                            <Select
                                placeholder="Select status"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {columns.map((column) => (
                                    <Option
                                        key={column.slug}
                                        value={column.slug}
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

                    <Col xs={24} sm={12} lg={12}>
                        <Form.Item name="priority" label="Priority">
                            <Select placeholder="Select priority" allowClear>
                                <Option value="low">
                                    <Space>🟢 Low Priority</Space>
                                </Option>
                                <Option value="medium">
                                    <Space>🔵 Medium Priority</Space>
                                </Option>
                                <Option value="high">
                                    <Space>🔴 High Priority</Space>
                                </Option>
                                <Option value="highest">
                                    <Space>🔴 Highest Priority</Space>
                                </Option>
                                <Option value="urgent">
                                    <Space>🔴 Urgent Priority</Space>
                                </Option>
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12} lg={12}>
                        <Form.Item name="assigned_to" label="Assigned To">
                            <Select
                                placeholder="Select assignee"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) =>
                                    option?.children
                                        ?.toString()
                                        .toLowerCase()
                                        .includes(input.toLowerCase()) ?? false
                                }
                            >
                                {users.map((user) => (
                                    <Option key={user.id} value={user.id}>
                                        {user.name}
                                        {user.designation_name && (
                                            <span className="text-gray-500 text-sm">
                                                {" "}
                                                ({user.designation_name})
                                            </span>
                                        )}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12} lg={12}>
                        <Form.Item name="project_id" label="Project">
                            <Select
                                placeholder="Select project"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) =>
                                    option?.children
                                        ?.toString()
                                        .toLowerCase()
                                        .includes(input.toLowerCase()) ?? false
                                }
                            >
                                {projects.map((project) => (
                                    <Option key={project.id} value={project.id}>
                                        {project.project_name}
                                        {project.project_short_code && (
                                            <span className="text-gray-500 text-sm">
                                                {" "}
                                                ({project.project_short_code})
                                            </span>
                                        )}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12} lg={12}>
                        <Form.Item name="category_id" label="Category">
                            <Select
                                placeholder="Select category"
                                allowClear
                                showSearch
                                optionFilterProp="children"
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

                    <Col xs={24} sm={12} lg={12}>
                        <Form.Item name="labels" label="Labels">
                            <Select
                                mode="multiple"
                                placeholder="Select labels"
                                allowClear
                                maxTagCount={2}
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

                    <Col xs={24} sm={12} lg={12}>
                        <Form.Item name="due_date_range" label="Due Date Range">
                            <RangePicker
                                style={{ width: "100%" }}
                                format={companyDateDayjsFormat()}
                                placeholder={["Start Date", "End Date"]}
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12} lg={12}>
                        <Form.Item
                            name="created_date_range"
                            label="Created Date Range"
                        >
                            <RangePicker
                                style={{ width: "100%" }}
                                format={companyDateDayjsFormat()}
                                placeholder={["Start Date", "End Date"]}
                            />
                        </Form.Item>
                    </Col>
                </Row>
            </Card>
        </Form>
    );
};

export default AdvancedTaskFilterForm;
