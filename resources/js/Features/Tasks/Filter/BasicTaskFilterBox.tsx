import React from "react";
import { Form, Select, Input, Button, Space, Row, Col } from "antd";
import {
    SearchOutlined,
    ClearOutlined,
    FilterOutlined,
} from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
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
                            label={td("Search Tasks", { source: "en" })}
                            className="mb-0"
                        >
                            <Search
                                placeholder={td("Search by title or description...", { source: "en" })}
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
                            label={td("Status", { source: "en" })}
                            className="mb-0"
                        >
                            <Select
                                placeholder={td("All Status", { source: "en" })}
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
                            label={td("Priority", { source: "en" })}
                            className="mb-0"
                        >
                            <Select
                                placeholder={td("All Priorities", { source: "en" })}
                                allowClear
                                onChange={(value) =>
                                    handleFilterChange("priority", value)
                                }
                            >
                                <Option value="urgent">
                                    <Space>{td("🔴 Urgent", { source: "en" })}</Space>
                                </Option>
                                <Option value="highest">
                                    <Space>{td("🔴 Highest", { source: "en" })}</Space>
                                </Option>
                                <Option value="high">
                                    <Space>{td("🔴 High", { source: "en" })}</Space>
                                </Option>
                                <Option value="medium">
                                    <Space>{td("🔵 Medium", { source: "en" })}</Space>
                                </Option>
                                <Option value="low">
                                    <Space>{td("🟢 Low", { source: "en" })}</Space>
                                </Option>
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={6} lg={4}>
                        <Form.Item
                            name="assigned_to"
                            label={td("Assignee", { source: "en" })}
                            className="mb-0"
                        >
                            <Select
                                placeholder={td("All Assignees", { source: "en" })}
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
                            label={td("Project", { source: "en" })}
                            className="mb-0"
                        >
                            <Select
                                placeholder={td("All Projects", { source: "en" })}
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
                                    title={td("Clear Filters", { source: "en" })}
                                >
                                    {td("Clear", { source: "en" })}
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
