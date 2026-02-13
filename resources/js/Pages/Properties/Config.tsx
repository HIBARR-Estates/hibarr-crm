import { useState, useMemo } from "react";
import { Link } from "@inertiajs/react";
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
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ArrowLeftOutlined,
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
                title: "Name",
                dataIndex: "name",
                key: "name",
                width: 200,
                render: (val: string) => (
                    <Text strong className="font-mono text-sm">
                        {val}
                    </Text>
                ),
            },
            {
                title: "Display Label",
                dataIndex: "label",
                key: "label",
                width: 220,
                render: (val: string) => <Tag color="blue">{val}</Tag>,
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
                    val ? (
                        <Tag color="geekblue">{val}</Tag>
                    ) : (
                        <Text type="secondary">—</Text>
                    ),
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
                        <Tag color="green">{city.label}</Tag>
                    ) : (
                        <Text type="secondary">—</Text>
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
                width: 120,
                align: "center",
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
    }, [activeType, deletingId, deleteMutation.isPending]);

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

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: "Properties", url: route("properties.index") },
                { name: "Configuration" },
            ]}
        >
            <div className="max-w-7xl mx-auto space-y-4">
                {/* Back to Properties */}
                {/* <div>
                    <Link href={route("properties.index")}>
                        <Button
                            type="text"
                            icon={<ArrowLeftOutlined />}
                            size="small"
                        >
                            Back to Properties
                        </Button>
                    </Link>
                </div> */}

                {/* Main Content: Vertical Tabs + Table */}
                <Card className="shadow-sm" styles={{ body: { padding: 0 } }}>
                    <div className="flex min-h-[70vh]">
                        {/* Left: Vertical Tabs */}
                        <div className="border-r border-gray-200 bg-gray-50/50 w-[240px] md:w-[240px]">
                            <div className="p-4 border-b border-gray-200">
                                <Title
                                    level={5}
                                    className="!mb-0 !text-gray-600"
                                >
                                    Categories
                                </Title>
                            </div>
                            <Tabs
                                tabPosition="left"
                                activeKey={activeType}
                                onChange={(key) =>
                                    setActiveType(key as ConfigTypeSlug)
                                }
                                items={tabItems}
                                className="config-vertical-tabs"
                                style={{ minHeight: "calc(70vh - 57px)" }}
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

                        {/* Right: Table Content */}
                        <div className="flex-1 flex flex-col">
                            {/* Table Header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-200">
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

                            {/* Table */}
                            <div className="flex-1 p-4">
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
                                ) : (
                                    <Table
                                        columns={columns}
                                        dataSource={items}
                                        rowKey="id"
                                        loading={isLoadingItems}
                                        pagination={
                                            items.length > 20
                                                ? {
                                                      pageSize: 20,
                                                      showSizeChanger: false,
                                                  }
                                                : false
                                        }
                                        size="middle"
                                        scroll={{ y: "calc(70vh - 200px)" }}
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
            />
        </PageLayout>
    );
};

Config.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Config;
