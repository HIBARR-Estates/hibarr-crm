/**
 * ConstructionProjectsTable — reusable table for construction/developer projects.
 *
 * Used on Properties/Index page under the "Construction Projects" tab.
 * Shows paginated project listing with key columns, search, and action handlers.
 */

import { useState, useCallback, useMemo } from "react";
import { Link, router } from "@inertiajs/react";
import {
    Button,
    Tag,
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
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import { currencySymbolForCode, formatLocationNameForDisplay } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Text } = Typography;

// ============================================
// Types
// ============================================

interface PaginationData extends LaravelPaginationMeta {
    data: DeveloperProject[];
}

interface ConstructionProjectsTableProps {
    projects: PaginationData | null;
    onEdit: (project: DeveloperProject) => void;
    onAdd: () => void;
    loading?: boolean;
}

// ============================================
// Helpers — defined outside the component so they are never re-created
// ============================================

const formatPrice = (
    price: number | null,
    currency: string | null | undefined,
): string => {
    if (price === null || price === undefined) return "-";
    const symbol = currencySymbolForCode(currency || "GBP");
    return `${symbol}${Number(price).toLocaleString("en-GB", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`;
};

const statusColor = (status: string | null): string => {
    switch (status) {
        case "off_plan":
            return "processing";
        case "under_construction":
            return "warning";
        case "ready_to_move":
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
    const { td } = useTd();
    const [searchValue, setSearchValue] = useState("");

    const handleSearch = useCallback((value: string) => {
        router.get(
            route("properties.index"),
            { cp_search: value || undefined, cp_page: 1 },
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
            onSuccess: () => router.reload({ only: ["constructionProjects"] }),
        });
    }, []);

    const handlePageChange = useCallback(
        (page: number) => {
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
        [],
    );

    const columns: TableColumnsType<DeveloperProject> = useMemo(
        () => [
            {
                title: td("Name", { source: "en" }),
                dataIndex: "name",
                key: "name",
                width: 220,
                render: (name: string) => (
                    <span className="font-medium text-gray-900">{name}</span>
                ),
            },
            {
                title: td("Ref", { source: "en" }),
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
                title: td("Developer", { source: "en" }),
                key: "developer",
                width: 160,
                render: (_: unknown, record: DeveloperProject) =>
                    record.developer ? (
                        <span>{record.developer.name}</span>
                    ) : (
                        <span className="text-gray-400">-</span>
                    ),
            },
            {
                title: td("Location", { source: "en" }),
                dataIndex: "location",
                key: "location",
                width: 150,
                render: (location: ProjectLocation | undefined) =>
                    location ? (
                        <Tag color="blue">
                            {formatLocationNameForDisplay(location.name)}
                        </Tag>
                    ) : (
                        <span className="text-gray-400">{td("Not assigned", { source: "en" })}</span>
                    ),
            },
            {
                title: td("Status", { source: "en" }),
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
                title: td("Starting Price", { source: "en" }),
                dataIndex: "starting_price",
                key: "starting_price",
                width: 130,
                align: "right",
                render: (price: number | null, record) =>
                    formatPrice(price, record.currency),
            },
            {
                title: td("Properties", { source: "en" }),
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
                title: td("Unit Types", { source: "en" }),
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
            {
                title: td("Actions", { source: "en" }),
                key: "actions",
                align: "center",
                width: 80,
                render: (_: unknown, record: DeveloperProject) => {
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
                                    {td("View", { source: "en" })}
                                </Link>
                            ),
                        },
                        {
                            key: "edit",
                            label: (
                                <span onClick={() => onEdit(record)}>
                                    <EditOutlined className="mr-2" />
                                    {td("Edit", { source: "en" })}
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
                                    {td("Expose Config", { source: "en" })}
                                </Link>
                            ),
                        },
                        { type: "divider" },
                        {
                            key: "delete",
                            label: (
                                <Popconfirm
                                    title={td("Delete Project", { source: "en" })}
                                    description={td("Are you sure? Properties will be unassigned.", { source: "en" })}
                                    onConfirm={() => handleDelete(record)}
                                    okText={td("Delete", { source: "en" })}
                                    cancelText={td("Cancel", { source: "en" })}
                                    okButtonProps={{ danger: true }}
                                >
                                    <span className="text-red-600">
                                        <DeleteOutlined className="mr-2" />
                                        {td("Delete", { source: "en" })}
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
        ],
        [onEdit, handleDelete],
    );

    const paginationMeta: LaravelPaginationMeta | null = projects
        ? {
              current_page: projects.current_page,
              last_page: projects.last_page,
              per_page: projects.per_page,
              total: projects.total,
              from: projects.from,
              to: projects.to,
          }
        : null;

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                    {td("Add Project", { source: "en" })}
                </Button>

                <Input.Search
                    placeholder={td("Search projects...", { source: "en" })}
                    allowClear
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onSearch={handleSearch}
                    style={{ width: 280 }}
                    prefix={<SearchOutlined className="text-gray-400" />}
                />
            </div>

            {/* DataTable */}
            <DataTable<DeveloperProject>
                columns={columns}
                dataSource={projects?.data ?? []}
                rowKey="id"
                loading={loading}
                paginationData={paginationMeta}
                onPageChange={handlePageChange}
                onRow={(record) => ({
                    onClick: () =>
                        router.visit(
                            route("developer-projects.show", record.id),
                        ),
                    className: "cursor-pointer",
                })}
                emptyState={{
                    title: td("No projects found", { source: "en" }),
                    description:
                        "Try adjusting your search or add a new project.",
                }}
                scroll={{ x: 1200, y: "calc(100vh - 320px)" }}
                size="small"
            />
        </div>
    );
};

export default ConstructionProjectsTable;
