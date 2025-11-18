import React from "react";
import { Form, Select, Input, Button, Space, Row, Col } from "antd";
import {
    SearchOutlined,
    ClearOutlined,
    FilterOutlined,
} from "@ant-design/icons";

const { Option } = Select;
const { Search } = Input;

interface TaskCategory {
    id: number;
    category_name: string;
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

interface BasicTaskFilterBoxProps {
    filters: any;
    handleResetFilters: () => void;
    handleQuickFilter: (key: string, value: any) => void;
    handleResetQuickFilters: () => void;
    handleSubmit: (filters: any) => void;
    categories?: TaskCategory[];
    columns?: TaskboardColumn[];
    users?: User[];
    projects?: Project[];
}

const BasicTaskFilterBox: React.FC<BasicTaskFilterBoxProps> = ({
    filters,
    handleResetFilters,
    handleQuickFilter,
    handleResetQuickFilters,
    handleSubmit,
    categories = [],
    columns = [],
    users = [],
    projects = [],
}) => {
    const [form] = Form.useForm();

    const handleSearchChange = (value: string) => {
        handleQuickFilter("search", value);
    };

    const handleFilterChange = (key: string, value: any) => {
        handleQuickFilter(key, value);
    };

    const handleReset = () => {
        form.resetFields();
        handleResetQuickFilters();
    };

    React.useEffect(() => {
        form.setFieldsValue(filters);
    }, [filters, form]);

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
            <Form form={form} layout="vertical" className="mb-0">
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={8} lg={6}>
                        <Form.Item
                            name="search"
                            label="Search Tasks"
                            className="mb-0"
                        >
                            <Search
                                placeholder="Search by title or description..."
                                allowClear
                                onSearch={handleSearchChange}
                                onChange={(e) =>
                                    handleSearchChange(e.target.value)
                                }
                                enterButton={<SearchOutlined />}
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={6} lg={4}>
                        <Form.Item
                            name="status"
                            label="Status"
                            className="mb-0"
                        >
                            <Select
                                placeholder="All Status"
                                allowClear
                                onChange={(value) =>
                                    handleFilterChange("status", value)
                                }
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

                    <Col xs={24} sm={6} lg={4}>
                        <Form.Item
                            name="priority"
                            label="Priority"
                            className="mb-0"
                        >
                            <Select
                                placeholder="All Priorities"
                                allowClear
                                onChange={(value) =>
                                    handleFilterChange("priority", value)
                                }
                            >
                                <Option value="high">
                                    <Space>🔴 High</Space>
                                </Option>
                                <Option value="medium">
                                    <Space>🔵 Medium</Space>
                                </Option>
                                <Option value="low">
                                    <Space>🟢 Low</Space>
                                </Option>
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={6} lg={4}>
                        <Form.Item
                            name="assigned_to"
                            label="Assignee"
                            className="mb-0"
                        >
                            <Select
                                placeholder="All Assignees"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) =>
                                    option?.children
                                        ?.toString()
                                        .toLowerCase()
                                        .includes(input.toLowerCase()) ?? false
                                }
                                onChange={(value) =>
                                    handleFilterChange("assigned_to", value)
                                }
                            >
                                {users.map((user) => (
                                    <Option key={user.id} value={user.id}>
                                        {user.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={6} lg={4}>
                        <Form.Item
                            name="project_id"
                            label="Project"
                            className="mb-0"
                        >
                            <Select
                                placeholder="All Projects"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) =>
                                    option?.children
                                        ?.toString()
                                        .toLowerCase()
                                        .includes(input.toLowerCase()) ?? false
                                }
                                onChange={(value) =>
                                    handleFilterChange("project_id", value)
                                }
                            >
                                {projects.map((project) => (
                                    <Option key={project.id} value={project.id}>
                                        {project.project_name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={6} lg={2}>
                        <Form.Item label=" " className="mb-0">
                            <Space>
                                <Button
                                    icon={<ClearOutlined />}
                                    onClick={handleReset}
                                    title="Clear Filters"
                                >
                                    Clear
                                </Button>
                            </Space>
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </div>
    );
};

export default BasicTaskFilterBox;
