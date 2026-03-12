import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    Table,
    Button,
    Tabs,
    Badge,
    Popconfirm,
    Card,
    Empty,
    Typography,
    Space,
    Tag,
    Tooltip,
    Select,
    Input,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    HomeOutlined,
    ApartmentOutlined,
    TagOutlined,
    EyeOutlined,
    FileProtectOutlined,
    BuildOutlined,
    AppstoreOutlined,
    BorderBottomOutlined,
    CheckCircleOutlined,
    ReloadOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";
import ConfigItemModal from "@/Features/Properties/Config/ConfigItemModal";
import type {
    PropertyConfigItem,
    ConfigTypesResponse,
    ConfigItemsResponse,
    ConfigTypeSlug,
} from "@/Types/propertyConfig";
import { CONFIG_CATEGORIES, CONFIG_TYPE_ORDER } from "@/Types/propertyConfig";

const { Text, Title } = Typography;

/** Map category name → Tag color for the table */
const CATEGORY_COLOR_MAP: Record<string, string> = {
    residential: "green",
    commercial: "blue",
    land: "orange",
};

/** Icon component map — resolves icon name strings to actual components */
const ICON_MAP: Record<string, React.ReactNode> = {
    HomeOutlined: <HomeOutlined />,
    ApartmentOutlined: <ApartmentOutlined />,
    TagOutlined: <TagOutlined />,
    EyeOutlined: <EyeOutlined />,
    FileProtectOutlined: <FileProtectOutlined />,
    BuildOutlined: <BuildOutlined />,
    AppstoreOutlined: <AppstoreOutlined />,
    BorderBottomOutlined: <BorderBottomOutlined />,
    CheckCircleOutlined: <CheckCircleOutlined />,
};

interface ConfigProps {
    pageTitle: string;
}

const Config = ({ pageTitle }: ConfigProps) => {
    const [activeType, setActiveType] =
        useState<ConfigTypeSlug>("property-types");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<PropertyConfigItem | null>(
        null,
    );

    const activeMeta = CONFIG_CATEGORIES[activeType];

    // Search & filter state
    const [searchText, setSearchText] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [filterCityId, setFilterCityId] = useState<number | undefined>();

    // Debounce search input (300ms)
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
        return () => clearTimeout(timer);
    }, [searchText]);

    // Reset search/filter + selections when switching tabs
    useEffect(() => {
        setSearchText("");
        setDebouncedSearch("");
        setFilterCityId(undefined);
        setSelectedRowKeys([]);
        setBulkCategory(undefined);
    }, [activeType]);

    // Fetch type summary counts
    const typesQuery = useApiQuery<ConfigTypesResponse>({
        path: route("property-config.types"),
    });

    // Fetch items for the active type
    const itemsQuery = useApiQuery<ConfigItemsResponse>({
        path: route("property-config.index", { type: activeType }),
    });

    // Fetch cities (used for the areas type to show parent city)
    const citiesQuery = useApiQuery<ConfigItemsResponse>({
        path: route("property-config.index", { type: "cities" }),
    });
    const cityItems = citiesQuery.data?.data || [];

    // Fetch primary categories (used for property-types to assign a category)
    const categoriesQuery = useApiQuery<ConfigItemsResponse>({
        path: route("property-config.index", { type: "primary-categories" }),
    });
    const categoryItems = categoriesQuery.data?.data || [];

    // Row selection for bulk actions (property-types only)
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [bulkCategory, setBulkCategory] = useState<string | undefined>();

    // Bulk assign category mutation
    const bulkCategoryMutation = useApiMutate<
        { ids: number[]; category: string },
        null,
        ApiSuccessResponse<null>
    >(route("property-config.bulk-category"), "POST", () => {
        setSelectedRowKeys([]);
        setBulkCategory(undefined);
    });

    const handleBulkAssignCategory = () => {
        if (!bulkCategory || selectedRowKeys.length === 0) return;
        bulkCategoryMutation.mutate({
            ids: selectedRowKeys as number[],
            category: bulkCategory,
        });
    };

    // Delete mutation
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const deleteMutation = useApiMutate<
        Record<string, never>,
        null,
        ApiSuccessResponse<null>
    >(
        deletingId
            ? route("property-config.destroy", {
                  type: activeType,
                  id: deletingId,
              })
            : "",
        "DELETE",
        () => {
            setDeletingId(null);
        },
    );

    const handleDelete = (id: number) => {
        setDeletingId(id);
        // Small delay to let state update so the route resolves
        setTimeout(() => {
            deleteMutation.mutate({});
        }, 0);
    };

    const handleOpenCreate = () => {
        setEditingItem(null);
        setModalOpen(true);
    };

    const handleOpenEdit = (item: PropertyConfigItem) => {
        setEditingItem(item);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setEditingItem(null);
    };

    // Build counts map from types query
    const countsMap = useMemo(() => {
        const map: Record<string, number> = {};
        typesQuery.data?.data?.forEach((t) => {
            map[t.slug] = t.count;
        });
        return map;
    }, [typesQuery.data]);

    // Table columns
    const columns: ColumnsType<PropertyConfigItem> = useMemo(() => {
        const cols: ColumnsType<PropertyConfigItem> = [
            {
                title: "Display Label",
                dataIndex: "label",
                key: "label",
                width: 220,
                render: (val: string) => <Text strong>{val}</Text>,
            },
        ];

        // Show parent_type column only for sub-types
        if (activeType === "sub-types") {
            cols.push({
                title: "Parent Type",
                dataIndex: "parent_type",
                key: "parent_type",
                width: 160,
                render: (val: string | null) =>
                    val ? <Text>{val}</Text> : <Text type="secondary">—</Text>,
            });
        }

        // Show city column only for areas
        if (activeType === "areas") {
            cols.push({
                title: "City",
                dataIndex: "city_id",
                key: "city_id",
                width: 160,
                render: (val: number | null) => {
                    const city = cityItems.find((c) => c.id === val);
                    return city ? (
                        <Text>{city.label}</Text>
                    ) : (
                        <Text type="secondary">—</Text>
                    );
                },
            });
        }

        // Show category column only for property-types
        if (activeType === "property-types") {
            cols.push({
                title: "Category",
                dataIndex: "category",
                key: "category",
                width: 140,
                filters: categoryItems.map((c) => ({
                    text: c.label,
                    value: c.name,
                })),
                onFilter: (value, record) => record.category === value,
                render: (val: string | null | undefined) => {
                    if (!val) return <Text type="secondary">—</Text>;
                    const cat = categoryItems.find((c) => c.name === val);
                    return (
                        <Tag color={CATEGORY_COLOR_MAP[val] || "default"}>
                            {cat?.label || val}
                        </Tag>
                    );
                },
            });
        }

        cols.push(
            {
                title: "Description",
                dataIndex: "description",
                key: "description",
                ellipsis: true,
                responsive: ["md"],
                render: (val: string | null) =>
                    val ? (
                        <Tooltip title={val}>
                            <Text type="secondary">{val}</Text>
                        </Tooltip>
                    ) : (
                        <Text type="secondary" italic>
                            No description
                        </Text>
                    ),
            },
            {
                title: "Actions",
                key: "actions",
                width: 100,
                align: "right",
                render: (_: unknown, record: PropertyConfigItem) => (
                    <Space size="small">
                        <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleOpenEdit(record)}
                        />
                        <Popconfirm
                            title="Delete this item?"
                            description={`"${record.label}" will be permanently removed.`}
                            onConfirm={() => handleDelete(record.id)}
                            okText="Delete"
                            cancelText="Cancel"
                            okButtonProps={{
                                danger: true,
                                loading:
                                    deletingId === record.id &&
                                    deleteMutation.isPending,
                            }}
                        >
                            <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                            />
                        </Popconfirm>
                    </Space>
                ),
            },
        );

        return cols;
    }, [
        activeType,
        deletingId,
        deleteMutation.isPending,
        cityItems,
        categoryItems,
    ]);

    // Build vertical tab items
    const tabItems = CONFIG_TYPE_ORDER.map((slug) => {
        const meta = CONFIG_CATEGORIES[slug];
        const icon = ICON_MAP[meta.icon] ?? <AppstoreOutlined />;
        const count = countsMap[slug] ?? 0;

        return {
            key: slug,
            label: (
                <div className="flex items-center justify-between gap-2 w-full min-w-[180px]">
                    <span className="flex items-center gap-2">
                        {icon}
                        <span>{meta.label}</span>
                    </span>
                    <Badge
                        count={count}
                        showZero
                        color={slug === activeType ? "#1677ff" : "#d9d9d9"}
                        style={{ marginLeft: 4 }}
                    />
                </div>
            ),
        };
    });

    const items = itemsQuery.data?.data ?? [];
    const isLoadingItems = itemsQuery.isLoading;

    // Client-side filtered items
    const filteredItems = useMemo(() => {
        let result = items;
        if (debouncedSearch) {
            const needle = debouncedSearch.toLowerCase();
            result = result.filter((item) =>
                item.label.toLowerCase().includes(needle),
            );
        }
        if (activeType === "areas" && filterCityId != null) {
            result = result.filter((item) => item.city_id === filterCityId);
        }
        return result;
    }, [items, debouncedSearch, activeType, filterCityId]);

    const hasActiveFilters = debouncedSearch !== "" || filterCityId != null;

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: "Properties", url: route("properties.index") },
                { name: "Configuration" },
            ]}
        >
            <div
                className="max-w-7xl mx-auto"
                style={{ height: "calc(100vh - 140px)" }}
            >
                {/* Main Content: Vertical Tabs + Table */}
                <Card
                    className="shadow-sm h-full"
                    styles={{ body: { padding: 0, height: "100%" } }}
                >
                    <div className="flex h-full overflow-hidden">
                        {/* Left: Vertical Tabs */}
                        <div className="border-r border-gray-200 bg-gray-50/50 w-[240px] flex-shrink-0 flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <Title
                                    level={5}
                                    className="!mb-0 !text-gray-600"
                                >
                                    Categories
                                </Title>
                            </div>
                            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                                <Tabs
                                    tabPosition="left"
                                    activeKey={activeType}
                                    onChange={(key) =>
                                        setActiveType(key as ConfigTypeSlug)
                                    }
                                    items={tabItems}
                                    tabBarStyle={{
                                        width: 240,
                                        marginRight: 0,
                                        borderRight: "none",
                                    }}
                                    renderTabBar={(props, DefaultTabBar) => (
                                        <DefaultTabBar
                                            {...props}
                                            className="!border-r-0"
                                        />
                                    )}
                                />
                            </div>
                        </div>

                        {/* Right: Table Content */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Table Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                                <div>
                                    <div className="flex items-center gap-2">
                                        {ICON_MAP[activeMeta.icon]}
                                        <Title level={5} className="!mb-0">
                                            {activeMeta.label}
                                        </Title>
                                        <Badge
                                            count={items.length}
                                            showZero
                                            color="#1677ff"
                                            className="ml-1"
                                        />
                                    </div>
                                    <Text
                                        type="secondary"
                                        className="text-xs mt-1"
                                    >
                                        {activeMeta.description}
                                    </Text>
                                </div>
                                <Space>
                                    <Button
                                        icon={<ReloadOutlined />}
                                        size="small"
                                        onClick={() => itemsQuery.refetch()}
                                        loading={isLoadingItems}
                                    >
                                        Refresh
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={handleOpenCreate}
                                    >
                                        Add {activeMeta.label.replace(/s$/, "")}
                                    </Button>
                                </Space>
                            </div>

                            {/* Filter Bar */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
                                <Input
                                    prefix={
                                        <SearchOutlined className="text-gray-400" />
                                    }
                                    placeholder={`Search ${activeMeta.label.toLowerCase()}...`}
                                    value={searchText}
                                    onChange={(e) =>
                                        setSearchText(e.target.value)
                                    }
                                    allowClear
                                    style={{ maxWidth: 320 }}
                                />
                                {activeType === "areas" && (
                                    <Select
                                        placeholder="Filter by city"
                                        value={filterCityId}
                                        onChange={setFilterCityId}
                                        allowClear
                                        showSearch
                                        optionFilterProp="label"
                                        style={{ width: 200 }}
                                        options={cityItems.map((c) => ({
                                            value: c.id,
                                            label: c.label,
                                        }))}
                                    />
                                )}
                                {hasActiveFilters && (
                                    <Text
                                        type="secondary"
                                        className="text-xs ml-auto"
                                    >
                                        {filteredItems.length} of {items.length}{" "}
                                        shown
                                    </Text>
                                )}
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {/* Bulk action bar for property-types */}
                                {activeType === "property-types" &&
                                    selectedRowKeys.length > 0 && (
                                        <div className="flex items-center gap-3 mb-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                            <Text className="text-sm text-blue-700">
                                                {selectedRowKeys.length}{" "}
                                                selected
                                            </Text>
                                            <Select
                                                placeholder="Assign category"
                                                value={bulkCategory}
                                                onChange={setBulkCategory}
                                                style={{ width: 180 }}
                                                size="small"
                                                allowClear
                                                options={categoryItems.map(
                                                    (c) => ({
                                                        value: c.name,
                                                        label: c.label,
                                                    }),
                                                )}
                                            />
                                            <Button
                                                type="primary"
                                                size="small"
                                                disabled={!bulkCategory}
                                                loading={
                                                    bulkCategoryMutation.isPending
                                                }
                                                onClick={
                                                    handleBulkAssignCategory
                                                }
                                            >
                                                Assign
                                            </Button>
                                            <Button
                                                size="small"
                                                onClick={() => {
                                                    setSelectedRowKeys([]);
                                                    setBulkCategory(undefined);
                                                }}
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    )}
                                {items.length === 0 && !isLoadingItems ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Empty
                                            description={
                                                <span>
                                                    No{" "}
                                                    {activeMeta.label.toLowerCase()}{" "}
                                                    configured yet.
                                                    <br />
                                                    <Button
                                                        type="link"
                                                        onClick={
                                                            handleOpenCreate
                                                        }
                                                        className="!p-0"
                                                    >
                                                        Add the first one
                                                    </Button>
                                                </span>
                                            }
                                        />
                                    </div>
                                ) : filteredItems.length === 0 &&
                                  hasActiveFilters ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Empty
                                            description={
                                                <span>
                                                    No matching{" "}
                                                    {activeMeta.label.toLowerCase()}{" "}
                                                    found.
                                                    <br />
                                                    <Button
                                                        type="link"
                                                        onClick={() => {
                                                            setSearchText("");
                                                            setFilterCityId(
                                                                undefined,
                                                            );
                                                        }}
                                                        className="!p-0"
                                                    >
                                                        Clear filters
                                                    </Button>
                                                </span>
                                            }
                                        />
                                    </div>
                                ) : (
                                    <Table
                                        columns={columns}
                                        dataSource={filteredItems}
                                        rowKey="id"
                                        loading={isLoadingItems}
                                        rowSelection={
                                            activeType === "property-types"
                                                ? {
                                                      selectedRowKeys,
                                                      onChange: (keys) =>
                                                          setSelectedRowKeys(
                                                              keys,
                                                          ),
                                                  }
                                                : undefined
                                        }
                                        pagination={
                                            filteredItems.length > 20
                                                ? {
                                                      pageSize: 20,
                                                      showSizeChanger: false,
                                                  }
                                                : false
                                        }
                                        size="middle"
                                        scroll={{ y: "calc(100vh - 420px)" }}
                                        tableLayout="auto"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Create / Edit Modal */}
            <ConfigItemModal
                open={modalOpen}
                onClose={handleCloseModal}
                activeType={activeType}
                categoryMeta={activeMeta}
                editingItem={editingItem}
                cities={cityItems.map((c) => ({ id: c.id, label: c.label }))}
                primaryCategories={categoryItems.map((c) => ({
                    name: c.name,
                    label: c.label,
                }))}
            />
        </PageLayout>
    );
};

Config.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Config;
