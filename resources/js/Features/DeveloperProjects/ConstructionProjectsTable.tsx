/**
 * ConstructionProjectsTable — reusable table for construction/developer projects.
 *
 * Used on Properties/Index page under the "Construction Projects" tab.
 * Shows paginated project listing with key columns, search, and action handlers.
 */

import { useState, useCallback } from "react";
import { Link, router } from "@inertiajs/react";
import {
    Table,
    Button,
    Tag,
    Space,
    Dropdown,
    Popconfirm,
    Input,
    Badge,
    Typography,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    MoreOutlined,
    SettingOutlined,
    SearchOutlined,
    TeamOutlined,
    BlockOutlined,
} from "@ant-design/icons";
import type {
    DeveloperProject,
    ProjectLocation,
} from "@/Types/developerProject";

const { Text } = Typography;

// ============================================
// Types
// ============================================

interface PaginationData {
    data: DeveloperProject[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface ConstructionProjectsTableProps {
    projects: PaginationData | null;
    onEdit: (project: DeveloperProject) => void;
    onAdd: () => void;
    loading?: boolean;
}

// ============================================
// Helpers
// ============================================

const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) return "-";
    return `€${Number(price).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const statusColor = (status: string | null): string => {
    switch (status) {
        case "off_plan":
            return "processing";
        case "under_construction":
            return "warning";
        case "ready_to_move":
            return "success";
        case "completed":
            return "success";
        default:
            return "default";
    }
};

const statusLabel = (status: string | null): string => {
    if (!status) return "-";
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

// ============================================
// Component
// ============================================

const ConstructionProjectsTable: React.FC<ConstructionProjectsTableProps> = ({
    projects,
    onEdit,
    onAdd,
    loading = false,
}) => {
    const [searchValue, setSearchValue] = useState("");

    const handleSearch = useCallback((value: string) => {
        router.get(
            route("properties.index"),
            {
                cp_search: value || undefined,
                cp_page: 1,
            },
            {
                preserveState: true,
                preserveScroll: false,
                only: ["constructionProjects"],
            },
        );
    }, []);

    const handleDelete = useCallback((project: DeveloperProject) => {
        router.delete(route("developer-projects.destroy", project.id), {
            preserveScroll: true,
            onSuccess: () => {
                router.reload({ only: ["constructionProjects"] });
            },
        });
    }, []);

    // Table columns
    const columns: TableColumnsType<DeveloperProject> = [
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            width: 220,
            render: (name: string) => (
                <span className="font-medium text-gray-900">{name}</span>
            ),
        },
        {
            title: "Ref",
            dataIndex: "reference_code",
            key: "reference_code",
            width: 100,
            render: (code: string | null) =>
                code ? (
                    <Text code className="text-xs">
                        {code}
                    </Text>
                ) : (
                    <span className="text-gray-400">-</span>
                ),
        },
        {
            title: "Developer",
            key: "developer",
            width: 160,
            render: (_, record) =>
                record.developer ? (
                    <span>{record.developer.name}</span>
                ) : (
                    <span className="text-gray-400">-</span>
                ),
        },
        {
            title: "Location",
            dataIndex: "location",
            key: "location",
            width: 150,
            render: (location: ProjectLocation | undefined) =>
                location ? (
                    <Tag color="blue">{location.name}</Tag>
                ) : (
                    <span className="text-gray-400">Not assigned</span>
                ),
        },
        {
            title: "Status",
            dataIndex: "construction_status",
            key: "construction_status",
            width: 140,
            render: (status: string | null) => (
                <Badge
                    status={statusColor(status) as any}
                    text={statusLabel(status)}
                />
            ),
        },
        {
            title: "Starting Price",
            dataIndex: "starting_price",
            key: "starting_price",
            width: 130,
            align: "right",
            render: (price: number | null) => formatPrice(price),
        },
        {
            title: "Properties",
            dataIndex: "properties_count",
            key: "properties_count",
            align: "center",
            width: 100,
            render: (count: number) => (
                <Tag color={count > 0 ? "green" : "default"}>
                    <TeamOutlined className="mr-1" />
                    {count || 0}
                </Tag>
            ),
        },
        {
            title: "Unit Types",
            dataIndex: "unit_types_count",
            key: "unit_types_count",
            align: "center",
            width: 100,
            render: (count: number) => (
                <Tag color={count > 0 ? "purple" : "default"}>
                    <BlockOutlined className="mr-1" />
                    {count || 0}
                </Tag>
            ),
        },
        // {
        //     title: "Expose",
        //     dataIndex: "expose_config",
        //     key: "expose_config",
        //     align: "center",
        //     width: 100,
        //     render: (config: any, record) =>
        //         config ? (
        //             <Tag color="purple">Configured</Tag>
        //         ) : (
        //             <Link
        //                 href={route(
        //                     "developer-projects.expose-config.show",
        //                     record.id,
        //                 )}
        //                 className="text-purple-600 hover:text-purple-800 text-xs"
        //             >
        //                 Setup
        //             </Link>
        //         ),
        // },
        {
            title: "Actions",
            key: "actions",
            align: "center",
            width: 80,
            render: (_, record) => {
                const items: MenuProps["items"] = [
                    {
                        key: "view",
                        label: (
                            <Link
                                href={route(
                                    "developer-projects.show",
                                    record.id,
                                )}
                            >
                                <EyeOutlined className="mr-2" />
                                View
                            </Link>
                        ),
                    },
                    {
                        key: "edit",
                        label: (
                            <span onClick={() => onEdit(record)}>
                                <EditOutlined className="mr-2" />
                                Edit
                            </span>
                        ),
                    },
                    {
                        key: "expose",
                        label: (
                            <Link
                                href={route(
                                    "developer-projects.expose-config.show",
                                    record.id,
                                )}
                            >
                                <SettingOutlined className="mr-2" />
                                Expose Config
                            </Link>
                        ),
                    },
                    { type: "divider" },
                    {
                        key: "delete",
                        label: (
                            <Popconfirm
                                title="Delete Project"
                                description="Are you sure? Properties will be unassigned."
                                onConfirm={() => handleDelete(record)}
                                okText="Delete"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                            >
                                <span className="text-red-600">
                                    <DeleteOutlined className="mr-2" />
                                    Delete
                                </span>
                            </Popconfirm>
                        ),
                    },
                ];

                return (
                    <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown menu={{ items }} trigger={["click"]}>
                            <Button type="text" icon={<MoreOutlined />} />
                        </Dropdown>
                    </div>
                );
            },
        },
    ];

    return (
        <div className="space-y-4">
            {/* Header with Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={onAdd}
                    >
                        Add Project
                    </Button>
                </div>
                <div className="flex items-center gap-3">
                    <Input.Search
                        placeholder="Search projects..."
                        allowClear
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onSearch={handleSearch}
                        style={{ width: 280 }}
                        prefix={<SearchOutlined className="text-gray-400" />}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-gray-200">
                <Table
                    columns={columns}
                    dataSource={projects?.data ?? []}
                    rowKey="id"
                    loading={loading}
                    onRow={(record) => ({
                        onClick: () =>
                            router.visit(
                                route("developer-projects.show", record.id),
                            ),
                        className:
                            "cursor-pointer hover:bg-blue-50 transition-colors",
                    })}
                    pagination={
                        projects
                            ? {
                                  current: projects.current_page,
                                  total: projects.total,
                                  pageSize: projects.per_page,
                                  showSizeChanger: false,
                                  showTotal: (total, range) =>
                                      `${range[0]}-${range[1]} of ${total} projects`,
                                  onChange: (page) => {
                                      router.get(
                                          route("properties.index"),
                                          { cp_page: page },
                                          {
                                              preserveState: true,
                                              preserveScroll: true,
                                              only: ["constructionProjects"],
                                          },
                                      );
                                  },
                              }
                            : false
                    }
                    scroll={{ x: 1200 }}
                    size="small"
                />
            </div>
        </div>
    );
};

export default ConstructionProjectsTable;
