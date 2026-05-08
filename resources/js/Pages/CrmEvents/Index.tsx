import React, { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    Tag,
    Select,
    Input,
    DatePicker,
    Button,
    Tooltip,
    Space,
    Drawer,
    Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
import {
    ReloadOutlined,
    FilterOutlined,
    ClearOutlined,
    UserOutlined,
    ThunderboltOutlined,
    ApiOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    MinusCircleOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type {
    CrmEvent,
    CrmEventCategory,
    CrmEventStatus,
    CrmEventDirection,
    CrmEventGenerationType,
} from "@/Types/api/crm-event";

dayjs.extend(relativeTime);

const { Text } = Typography;
const { RangePicker } = DatePicker;

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface FilterOption {
    value: string;
    label: string;
}

interface PaginatedEvents {
    data: CrmEvent[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

interface CrmEventsIndexProps {
    pageTitle: string;
    events: PaginatedEvents;
    categories: CrmEventCategory[];
    filters: Record<string, string | undefined>;
    filterOptions: {
        generation_types: FilterOption[];
        statuses: FilterOption[];
        directions: FilterOption[];
        sources: FilterOption[];
    };
}

// ────────────────────────────────────────────────────────────────────────────
// Display config maps
// ────────────────────────────────────────────────────────────────────────────

const GENERATION_CONFIG: Record<
    string,
    { label: string; icon: React.ReactNode; color: string }
> = {
    user_generated: { label: "Agent", icon: <UserOutlined />, color: "green" },
    system_generated: {
        label: "System",
        icon: <ThunderboltOutlined />,
        color: "blue",
    },
    external: { label: "External", icon: <ApiOutlined />, color: "orange" },
};

const STATUS_CONFIG: Record<
    CrmEventStatus,
    { label: string; icon: React.ReactNode; color: string }
> = {
    completed: {
        label: "Completed",
        icon: <CheckCircleOutlined />,
        color: "success",
    },
    error_occurred: {
        label: "Error",
        icon: <CloseCircleOutlined />,
        color: "error",
    },
    missed: {
        label: "Missed",
        icon: <ExclamationCircleOutlined />,
        color: "warning",
    },
    rejected: {
        label: "Rejected",
        icon: <MinusCircleOutlined />,
        color: "volcano",
    },
};

const DIRECTION_CONFIG: Record<
    CrmEventDirection,
    { label: string; icon: React.ReactNode; color: string }
> = {
    inbound: { label: "Inbound", icon: <ArrowDownOutlined />, color: "cyan" },
    outbound: {
        label: "Outbound",
        icon: <ArrowUpOutlined />,
        color: "geekblue",
    },
};

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

function Index({
    pageTitle,
    events,
    categories,
    filters,
    filterOptions,
}: CrmEventsIndexProps) {
    const { t } = useTranslation();
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [localFilters, setLocalFilters] = useState<
        Record<string, string | undefined>
    >({ ...filters });

    // Navigate with filters
    const applyFilters = useCallback(
        (overrides: Record<string, string | undefined> = {}) => {
            const merged = { ...localFilters, ...overrides };
            // Remove empty values
            const cleaned: Record<string, string> = {};
            for (const [k, v] of Object.entries(merged)) {
                if (v) cleaned[k] = v;
            }
            router.get("/account/crm-events", cleaned, {
                preserveState: true,
                preserveScroll: true,
            });
        },
        [localFilters],
    );

    const clearFilters = useCallback(() => {
        setLocalFilters({});
        router.get("/account/crm-events", {}, { preserveState: true });
    }, []);

    const handleSearch = useCallback(
        (value: string) => {
            const next = { ...localFilters, search: value || undefined };
            setLocalFilters(next);
            applyFilters(next);
        },
        [localFilters, applyFilters],
    );

    // Table columns
    const columns: TableColumnsType<CrmEvent> = [
        {
            title: "Event",
            dataIndex: ["event_type", "name"],
            key: "event",
            width: 220,
            render: (_: any, record: CrmEvent) => (
                <div>
                    <Text strong className="text-[13px]">
                        {record.event_type?.name ?? "Unknown"}
                    </Text>
                    {record.event_type?.category && (
                        <div>
                            <Tag className="text-[10px] mt-0.5" color="default">
                                {record.event_type.category.name}
                            </Tag>
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "Origin",
            dataIndex: "generation_type",
            key: "generation_type",
            width: 110,
            render: (val: string) => {
                const cfg = GENERATION_CONFIG[val];
                return cfg ? (
                    <Tag icon={cfg.icon} color={cfg.color}>
                        {cfg.label}
                    </Tag>
                ) : (
                    val
                );
            },
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 110,
            render: (val: CrmEventStatus) => {
                const cfg = STATUS_CONFIG[val];
                return cfg ? (
                    <Tag icon={cfg.icon} color={cfg.color}>
                        {cfg.label}
                    </Tag>
                ) : (
                    (val ?? "—")
                );
            },
        },
        {
            title: "Direction",
            dataIndex: "direction",
            key: "direction",
            width: 100,
            render: (val: CrmEventDirection | null) => {
                if (!val) return <Text type="secondary">—</Text>;
                const cfg = DIRECTION_CONFIG[val];
                return cfg ? (
                    <Tag icon={cfg.icon} color={cfg.color}>
                        {cfg.label}
                    </Tag>
                ) : (
                    val
                );
            },
        },
        {
            title: "User",
            dataIndex: "user",
            key: "user",
            width: 140,
            render: (_: any, record: CrmEvent) =>
                record.user ? (
                    <Text className="text-[13px]">
                        <UserOutlined className="mr-1 text-gray-400" />
                        {record.user.name}
                    </Text>
                ) : (
                    <Text type="secondary">—</Text>
                ),
        },
        {
            title: "Model",
            key: "model",
            width: 130,
            render: (_: any, record: CrmEvent) =>
                record.model_type ? (
                    <Text className="text-[12px] text-gray-500">
                        {record.model_type}
                        {record.model_id ? ` #${record.model_id}` : ""}
                    </Text>
                ) : (
                    <Text type="secondary">—</Text>
                ),
        },
        {
            title: "Source",
            dataIndex: "source",
            key: "source",
            width: 90,
            render: (val: string | null) =>
                val ? (
                    <Tag className="text-[10px]" color="default">
                        {val}
                    </Tag>
                ) : (
                    "—"
                ),
        },
        {
            title: "Message",
            key: "message",
            width: 200,
            ellipsis: true,
            render: (_: any, record: CrmEvent) => {
                const msg = record.metadata?.comment as string | undefined;
                return msg ? (
                    <Tooltip title={msg}>
                        <Text className="text-[12px] text-gray-600">{msg}</Text>
                    </Tooltip>
                ) : (
                    <Text type="secondary">—</Text>
                );
            },
        },
        {
            title: "Occurred",
            dataIndex: "occurred_at",
            key: "occurred_at",
            width: 140,
            sorter: true,
            render: (val: string) => (
                <Tooltip title={dayjs(val).format("YYYY-MM-DD HH:mm:ss")}>
                    <Text className="text-[12px]">{dayjs(val).fromNow()}</Text>
                </Tooltip>
            ),
        },
    ];

    const hasActiveFilters = Object.values(filters).some((v) => v);

    return (
        <PageLayout title={pageTitle} breadcrumbs={[{ name: t("app.crm_events.title") }]}>
            <div className="max-w-7xl mx-auto">
                {/* Toolbar */}
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <Input.Search
                        placeholder="Search events, users, UUID…"
                        allowClear
                        defaultValue={filters.search}
                        onSearch={handleSearch}
                        style={{ maxWidth: 320 }}
                    />

                    <Space>
                        <Button
                            icon={<FilterOutlined />}
                            onClick={() => setFiltersOpen(true)}
                            type={hasActiveFilters ? "primary" : "default"}
                            ghost={hasActiveFilters}
                        >
                            Filters
                            {hasActiveFilters && (
                                <span className="ml-1 bg-blue-500 text-white rounded-full text-[10px] w-4 h-4 inline-flex items-center justify-center">
                                    {
                                        Object.values(filters).filter(Boolean)
                                            .length
                                    }
                                </span>
                            )}
                        </Button>
                        {hasActiveFilters && (
                            <Button
                                icon={<ClearOutlined />}
                                onClick={clearFilters}
                            >
                                Clear
                            </Button>
                        )}
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => router.reload()}
                        />
                    </Space>
                </div>

                {/* Table */}
                <DataTable<CrmEvent>
                    dataSource={events.data}
                    columns={columns}
                    rowKey="uuid"
                    size="small"
                    scroll={{ x: 1200, y: "calc(100vh - 280px)" }}
                    paginationData={{
                        current_page: events.current_page,
                        last_page: events.last_page,
                        per_page: events.per_page,
                        total: events.total,
                        from: events.from,
                        to: events.to,
                    }}
                    onPageChange={(page) => {
                        router.get(
                            "/account/crm-events",
                            {
                                ...filters,
                                page: String(page),
                                per_page: String(events.per_page),
                            },
                            { preserveState: true, preserveScroll: true },
                        );
                    }}
                    onChange={(_pagination, _tableFilters, sorter) => {
                        if (!Array.isArray(sorter) && sorter.field) {
                            applyFilters({
                                sort_by: String(sorter.field),
                                sort_direction:
                                    sorter.order === "ascend" ? "asc" : "desc",
                            });
                        }
                    }}
                />

                {/* Filters Drawer */}
                <Drawer
                    title="Filter Events"
                    open={filtersOpen}
                    onClose={() => setFiltersOpen(false)}
                    width={360}
                    extra={
                        <Button
                            type="primary"
                            onClick={() => {
                                applyFilters();
                                setFiltersOpen(false);
                            }}
                        >
                            Apply
                        </Button>
                    }
                >
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Category
                            </label>
                            <Select
                                className="w-full"
                                placeholder="All categories"
                                allowClear
                                value={localFilters.category_slug}
                                onChange={(val) =>
                                    setLocalFilters({
                                        ...localFilters,
                                        category_slug: val,
                                    })
                                }
                                options={categories.map((c) => ({
                                    label: c.name,
                                    value: c.slug,
                                }))}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Origin
                            </label>
                            <Select
                                className="w-full"
                                placeholder="All origins"
                                allowClear
                                value={localFilters.generation_type}
                                onChange={(val) =>
                                    setLocalFilters({
                                        ...localFilters,
                                        generation_type: val,
                                    })
                                }
                                options={filterOptions.generation_types}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Status
                            </label>
                            <Select
                                className="w-full"
                                placeholder="All statuses"
                                allowClear
                                value={localFilters.status}
                                onChange={(val) =>
                                    setLocalFilters({
                                        ...localFilters,
                                        status: val,
                                    })
                                }
                                options={filterOptions.statuses}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Direction
                            </label>
                            <Select
                                className="w-full"
                                placeholder="All directions"
                                allowClear
                                value={localFilters.direction}
                                onChange={(val) =>
                                    setLocalFilters({
                                        ...localFilters,
                                        direction: val,
                                    })
                                }
                                options={filterOptions.directions}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Source
                            </label>
                            <Select
                                className="w-full"
                                placeholder="All sources"
                                allowClear
                                value={localFilters.source}
                                onChange={(val) =>
                                    setLocalFilters({
                                        ...localFilters,
                                        source: val,
                                    })
                                }
                                options={filterOptions.sources}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">
                                Date Range
                            </label>
                            <RangePicker
                                className="w-full"
                                value={
                                    localFilters.date_from &&
                                    localFilters.date_to
                                        ? [
                                              dayjs(localFilters.date_from),
                                              dayjs(localFilters.date_to),
                                          ]
                                        : undefined
                                }
                                onChange={(dates) => {
                                    setLocalFilters({
                                        ...localFilters,
                                        date_from:
                                            dates?.[0]?.format("YYYY-MM-DD") ??
                                            undefined,
                                        date_to:
                                            dates?.[1]?.format("YYYY-MM-DD") ??
                                            undefined,
                                    });
                                }}
                            />
                        </div>
                    </div>
                </Drawer>
            </div>
        </PageLayout>
    );
}

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
