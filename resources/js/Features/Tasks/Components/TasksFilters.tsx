import React from "react";
import {
    Row,
    Col,
    Card,
    Select,
    Input,
    DatePicker,
    Button,
    Space,
    Tag,
} from "antd";
import {
    SearchOutlined,
    ClearOutlined,
    FilterOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Option } = Select;
const { Search } = Input;
const { RangePicker } = DatePicker;

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

interface FilterValues {
    status: string;
    priority: string;
    assigned_to: number | undefined;
    project_id: number | undefined;
    category_id: number | undefined;
    due_date_range: [string, string] | undefined;
    search: string;
}

interface TasksFiltersProps {
    categories: TaskCategory[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];
    filters: FilterValues;
    onFilterChange: (key: string, value: any) => void;
    onClearFilters: () => void;
    onSearch: (value: string) => void;
}

export const TasksFilters: React.FC<TasksFiltersProps> = ({
    categories,
    columns,
    users,
    projects,
    filters,
    onFilterChange,
    onClearFilters,
    onSearch,
}) => {
    // Count active filters
    const activeFilterCount =
        Object.values(filters).filter(
            (value) =>
                value !== "" &&
                value !== undefined &&
                value !== null &&
                (Array.isArray(value) ? value.length > 0 : true)
        ).length - (filters.search ? 1 : 0); // Don't count search as a filter

    return (
        <Card
            title={
                <Space>
                    <FilterOutlined />
                    Filters
                    {activeFilterCount > 0 && (
                        <Tag color="blue" style={{ marginLeft: 8 }}>
                            {activeFilterCount} active
                        </Tag>
                    )}
                </Space>
            }
            extra={
                activeFilterCount > 0 && (
                    <Button
                        type="link"
                        icon={<ClearOutlined />}
                        onClick={onClearFilters}
                        size="small"
                    >
                        Clear All
                    </Button>
                )
            }
            size="small"
            style={{ marginBottom: 16 }}
            variant="outlined"
        >
            <Row gutter={[16, 16]}>
                {/* Search */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Search
                        placeholder="Search tasks..."
                        allowClear
                        value={filters.search}
                        onChange={(e) =>
                            onFilterChange("search", e.target.value)
                        }
                        onSearch={onSearch}
                        prefix={<SearchOutlined />}
                        size="small"
                    />
                </Col>

                {/* Status Filter */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Select
                        placeholder="Filter by status"
                        allowClear
                        style={{ width: "100%" }}
                        value={filters.status || undefined}
                        onChange={(value) => onFilterChange("status", value)}
                        size="small"
                    >
                        {columns.map((column) => (
                            <Option key={column.id} value={column.slug}>
                                <Space>
                                    <div
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            backgroundColor: column.label_color,
                                            display: "inline-block",
                                        }}
                                    />
                                    {column.column_name}
                                </Space>
                            </Option>
                        ))}
                    </Select>
                </Col>

                {/* Priority Filter */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Select
                        placeholder="Filter by priority"
                        allowClear
                        style={{ width: "100%" }}
                        value={filters.priority || undefined}
                        onChange={(value) => onFilterChange("priority", value)}
                        size="small"
                    >
                        <Option value="low">
                            <Space>🟢 Low</Space>
                        </Option>
                        <Option value="medium">
                            <Space>🟡 Medium</Space>
                        </Option>
                        <Option value="high">
                            <Space>🔴 High</Space>
                        </Option>
                    </Select>
                </Col>

                {/* Assigned To Filter */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Select
                        placeholder="Filter by assignee"
                        allowClear
                        showSearch
                        style={{ width: "100%" }}
                        value={filters.assigned_to}
                        onChange={(value) =>
                            onFilterChange("assigned_to", value)
                        }
                        filterOption={(input, option) =>
                            option?.children
                                ?.toString()
                                .toLowerCase()
                                .includes(input.toLowerCase()) ?? false
                        }
                        size="small"
                    >
                        {users.map((user) => (
                            <Option key={user.id} value={user.id}>
                                {user.name}
                                {user.designation_name && (
                                    <span
                                        style={{
                                            color: "#666",
                                            fontSize: "12px",
                                        }}
                                    >
                                        {" "}
                                        ({user.designation_name})
                                    </span>
                                )}
                            </Option>
                        ))}
                    </Select>
                </Col>

                {/* Project Filter */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Select
                        placeholder="Filter by project"
                        allowClear
                        showSearch
                        style={{ width: "100%" }}
                        value={filters.project_id}
                        onChange={(value) =>
                            onFilterChange("project_id", value)
                        }
                        filterOption={(input, option) =>
                            option?.children
                                ?.toString()
                                .toLowerCase()
                                .includes(input.toLowerCase()) ?? false
                        }
                        size="small"
                    >
                        {projects.map((project) => (
                            <Option key={project.id} value={project.id}>
                                {project.project_name}
                                {project.project_short_code && (
                                    <span
                                        style={{
                                            color: "#666",
                                            fontSize: "12px",
                                        }}
                                    >
                                        {" "}
                                        ({project.project_short_code})
                                    </span>
                                )}
                            </Option>
                        ))}
                    </Select>
                </Col>

                {/* Category Filter */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Select
                        placeholder="Filter by category"
                        allowClear
                        style={{ width: "100%" }}
                        value={filters.category_id}
                        onChange={(value) =>
                            onFilterChange("category_id", value)
                        }
                        size="small"
                    >
                        {categories.map((category) => (
                            <Option key={category.id} value={category.id}>
                                {category.category_name}
                            </Option>
                        ))}
                    </Select>
                </Col>

                {/* Due Date Range Filter */}
                <Col xs={24} sm={12} md={8} lg={6}>
                    <RangePicker
                        placeholder={["Start Date", "End Date"]}
                        style={{ width: "100%" }}
                        value={
                            filters.due_date_range
                                ? [
                                      dayjs(filters.due_date_range[0]),
                                      dayjs(filters.due_date_range[1]),
                                  ]
                                : undefined
                        }
                        onChange={(dates) => {
                            if (dates && dates[0] && dates[1]) {
                                onFilterChange("due_date_range", [
                                    dates[0].format("YYYY-MM-DD"),
                                    dates[1].format("YYYY-MM-DD"),
                                ]);
                            } else {
                                onFilterChange("due_date_range", undefined);
                            }
                        }}
                        size="small"
                        allowClear
                    />
                </Col>
            </Row>
        </Card>
    );
};
