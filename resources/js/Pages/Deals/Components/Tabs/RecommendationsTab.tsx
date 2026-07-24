import { Deal } from "@/Types/api/deals";
import {
    PropertyRecommendation,
    RecommendationsResponse,
} from "@/Types/api/property-recommendation";
import {
    Empty,
    Button,
    Alert,
    Progress,
    Tag,
    Card,
    Row,
    Col,
    Tooltip,
    Typography,
    Space,
    Skeleton,
    message,
    Segmented,
} from "antd";
import type { TableColumnsType } from "antd";
import { DataTable } from "@/Components/DataTable";
import {
    ReloadOutlined,
    HomeOutlined,
    EnvironmentOutlined,
    DollarOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    MinusCircleOutlined,
    AppstoreOutlined,
    UnorderedListOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { Component, useState, useMemo } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { Link, router } from "@inertiajs/react";

const { Text, Title } = Typography;

type ViewMode = "cards" | "table";

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

interface RecommendationsTabErrorBoundaryState {
    hasError: boolean;
}

class RecommendationsTabErrorBoundary extends Component<
    { children: ReactNode },
    RecommendationsTabErrorBoundaryState
> {
    state: RecommendationsTabErrorBoundaryState = {
        hasError: false,
    };

    static getDerivedStateFromError(): RecommendationsTabErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("RecommendationsTab failed to render", {
            error,
            errorInfo,
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6">
                    <Alert
                        message="Recommendations are temporarily unavailable"
                        description="The recommendations panel hit an unexpected error. You can continue using the rest of this page and try refreshing recommendations again."
                        type="error"
                        showIcon
                        action={
                            <Button
                                size="small"
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={() => window.location.reload()}
                            >
                                Reload Page
                            </Button>
                        }
                    />
                </div>
            );
        }

        return this.props.children;
    }
}

export default function RecommendationsTab(props: Props) {
    return (
        <RecommendationsTabErrorBoundary>
            <RecommendationsTabContent {...props} />
        </RecommendationsTabErrorBoundary>
    );
}

/**
 * Property Recommendations Tab
 * Displays AI-powered property recommendations based on customer preferences
 */
function RecommendationsTabContent({ deal, permissions }: Props) {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>("cards");
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [addingPropertyIds, setAddingPropertyIds] = useState<Set<number>>(
        new Set(),
    );

    const queryPath = route("deals.recommendations.index", { deal: deal.id });

    // Fetch recommendations using useApiQuery
    const { data, isLoading, isError, error, refetch, isFetching } =
        useApiQuery<RecommendationsResponse>({
            path: queryPath,
            params: { limit: 10 },
        });

    const recommendations = data?.recommendations ?? [];
    const cached = data?.cached ?? false;
    const apiError =
        data?.error || (isError ? (error as Error)?.message : null);

    // Handle refresh - calls the refresh endpoint to invalidate server cache, then refetches
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await axios.post(
                route("deals.recommendations.refresh", { deal: deal.id }),
                { limit: 10 },
            );
            // Invalidate the query cache and refetch
            queryClient.invalidateQueries({ queryKey: [queryPath] });
        } catch (err) {
            console.error("Failed to refresh recommendations:", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    const loading = isRefreshing || isFetching;

    // Property ids already on the deal. A deal holds products; the Property is
    // reached through product.property — the two ids are NOT interchangeable.
    const existingPropertyIds = useMemo(
        () =>
            (deal.products ?? [])
                .map((p) => p.property?.id)
                .filter((id): id is number => typeof id === "number"),
        [deal.products],
    );

    // Add properties to deal mutation
    const handleAddPropertiesToDeal = async (propertyIds: number[]) => {
        if (propertyIds.length === 0) return;

        // Add property IDs to loading state
        setAddingPropertyIds((prev) => new Set([...prev, ...propertyIds]));
        try {
            // deals.properties.store resolves (or creates) the Product behind
            // the Property, guards duplicates and recalculates the deal value.
            // Syncing product_id with a property id attaches the wrong record.
            for (const propertyId of propertyIds) {
                await axios.post(
                    route("deals.properties.store", deal.id),
                    { property_id: propertyId },
                    { headers: { Accept: "application/json" } },
                );
            }

            message.success(
                `${propertyIds.length} ${
                    propertyIds.length === 1 ? "property" : "properties"
                } added to deal`,
            );

            // Clear selection
            setSelectedRowKeys([]);

            // Refresh the page to reflect updated deal
            router.reload({ only: ["deal", "productNames"] });
        } catch (error: any) {
            message.error(
                error?.response?.data?.message || "Failed to add properties",
            );
        } finally {
            // Remove property IDs from loading state
            setAddingPropertyIds((prev) => {
                const newSet = new Set(prev);
                propertyIds.forEach((id) => newSet.delete(id));
                return newSet;
            });
        }
    };

    // Check if a specific property is currently being added
    const isPropertyAdding = (propertyId: number | null): boolean => {
        if (!propertyId) return false;
        return addingPropertyIds.has(propertyId);
    };

    // Check if a property is already added to the deal
    const isPropertyInDeal = (propertyId: number | null): boolean => {
        if (!propertyId) return false;
        return existingPropertyIds.includes(propertyId);
    };

    // Build property show URL safely to avoid hard crashes from route param mismatches.
    const getPropertyShowHref = (propertyId: number | null | undefined) => {
        if (!propertyId) return null;

        try {
            return route("properties.show", { property: propertyId });
        } catch (primaryError) {
            // Keep a defensive fallback in case environments have inconsistent Ziggy parameter names.
            try {
                return route("properties.show", { id: propertyId });
            } catch (fallbackError) {
                console.error(
                    "Failed to build properties.show URL for recommendation",
                    {
                        propertyId,
                        primaryError,
                        fallbackError,
                    },
                );
                return null;
            }
        }
    };

    // Format price for display
    const formatPrice = (price: number | null | undefined): string => {
        if (!price) return "N/A";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
        }).format(price);
    };

    // Get color for match percentage
    const getMatchColor = (percentage: number | null): string => {
        if (!percentage) return "#d9d9d9";
        if (percentage >= 80) return "#52c41a";
        if (percentage >= 60) return "#1890ff";
        if (percentage >= 40) return "#faad14";
        return "#ff4d4f";
    };

    // Get color for factor score
    const getFactorColor = (score: number | null | undefined): string => {
        if (score === null || score === undefined) return "default";
        if (score >= 80) return "green";
        if (score >= 60) return "blue";
        if (score >= 40) return "orange";
        return "red";
    };

    // Get icon for factor score
    const getFactorIcon = (score: number | null | undefined) => {
        if (score === null || score === undefined)
            return <MinusCircleOutlined style={{ color: "#d9d9d9" }} />;
        if (score >= 80)
            return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
        if (score >= 60)
            return <CheckCircleOutlined style={{ color: "#1890ff" }} />;
        if (score >= 40)
            return <ExclamationCircleOutlined style={{ color: "#faad14" }} />;
        return <CloseCircleOutlined style={{ color: "#ff4d4f" }} />;
    };

    // Get status tag color
    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            available: "green",
            under_offer: "orange",
            sold: "red",
            rented: "blue",
            withdrawn: "default",
        };
        return colors[status] || "default";
    };

    // Table columns definition
    const tableColumns: TableColumnsType<PropertyRecommendation> = [
        {
            title: "Rank",
            dataIndex: "rank",
            key: "rank",
            width: 70,
            render: (rank: number) => (
                <div className="font-bold text-center">#{rank}</div>
            ),
        },
        {
            title: "Property",
            key: "property",
            width: 250,
            render: (_, record) => {
                const propertyHref = getPropertyShowHref(record.property?.id);

                return (
                    <div className="flex items-center gap-3">
                        {record.property?.primary_photo ? (
                            <img
                                src={record.property.primary_photo}
                                alt={record.property?.title}
                                className="w-16 h-12 object-cover rounded"
                            />
                        ) : (
                            <div className="w-16 h-12 bg-gray-100 rounded flex items-center justify-center">
                                <HomeOutlined className="text-gray-400" />
                            </div>
                        )}
                        <div>
                            {propertyHref ? (
                                <Link href={propertyHref} target="_blank">
                                    <Text
                                        strong
                                        ellipsis
                                        style={{ maxWidth: 150 }}
                                    >
                                        {record.property?.title ||
                                            `Property #${record.rank}`}
                                    </Text>
                                </Link>
                            ) : (
                                <Text strong ellipsis style={{ maxWidth: 150 }}>
                                    {record.property?.title ||
                                        `Property #${record.rank}`}
                                </Text>
                            )}
                            <div className="text-xs text-gray-500 capitalize">
                                {record.property?.property_type?.replace(
                                    "_",
                                    " ",
                                )}{" "}
                                for {record.property?.sale_type}
                            </div>
                        </div>
                    </div>
                );
            },
        },
        {
            title: "Match",
            key: "match",
            width: 100,
            align: "center",
            render: (_, record) => (
                <Progress
                    type="circle"
                    percent={record.match_percentage || 0}
                    width={45}
                    strokeColor={getMatchColor(record.match_percentage)}
                    format={(percent) => (
                        <span style={{ fontSize: 10 }}>{percent}%</span>
                    )}
                />
            ),
        },
        {
            title: "Location",
            key: "location",
            width: 150,
            render: (_, record) => (
                <div className="flex items-center gap-1">
                    <EnvironmentOutlined className="text-gray-400" />
                    <Text ellipsis style={{ maxWidth: 120 }}>
                        {record.property?.area
                            ? `${record.property.area}, `
                            : ""}
                        {record.property?.city || "N/A"}
                    </Text>
                </div>
            ),
        },
        {
            title: "Price",
            key: "price",
            width: 120,
            render: (_, record) => (
                <Text strong style={{ color: "#1890ff" }}>
                    {formatPrice(record.property?.price)}
                </Text>
            ),
        },
        {
            title: "Specs",
            key: "specs",
            width: 100,
            render: (_, record) => (
                <div className="text-sm">
                    {record.property?.bedrooms && (
                        <div>{record.property.bedrooms} Beds</div>
                    )}
                    {record.property?.bathrooms && (
                        <div>{record.property.bathrooms} Baths</div>
                    )}
                    {record.property?.land_size && (
                        <div>{record.property.land_size} m²</div>
                    )}
                </div>
            ),
        },
        {
            title: "Status",
            key: "status",
            width: 100,
            render: (_, record) =>
                record.property?.status ? (
                    <Tag color={getStatusColor(record.property.status)}>
                        {record.property.status.replace("_", " ")}
                    </Tag>
                ) : (
                    "--"
                ),
        },
        {
            title: "Match Factors",
            key: "factors",
            width: 200,
            render: (_, record) => (
                <div className="flex flex-wrap gap-1">
                    {record.factors?.slice(0, 3).map((factor, idx) => (
                        <Tooltip
                            key={idx}
                            title={`${factor.name}: ${
                                factor.detail || factor.status
                            }`}
                        >
                            <Tag
                                color={getFactorColor(factor.score)}
                                style={{ fontSize: 10, margin: 0 }}
                            >
                                {factor.name}:{" "}
                                {factor.status || `${factor.score}%`}
                            </Tag>
                        </Tooltip>
                    ))}
                    {record.factors && record.factors.length > 3 && (
                        <Tooltip
                            title={record.factors
                                .slice(3)
                                .map((f) => `${f.name}: ${f.status}`)
                                .join(", ")}
                        >
                            <Tag style={{ fontSize: 10, margin: 0 }}>
                                +{record.factors.length - 3} more
                            </Tag>
                        </Tooltip>
                    )}
                </div>
            ),
        },
        {
            title: "Action",
            key: "action",
            width: 100,
            fixed: "right",
            render: (_, record) => {
                const propertyId = record.property?.id;
                const isInDeal = isPropertyInDeal(propertyId || null);

                const isAdding = isPropertyAdding(propertyId || null);

                return isInDeal ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>
                        Added
                    </Tag>
                ) : (
                    <Button
                        size="small"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() =>
                            propertyId &&
                            handleAddPropertiesToDeal([propertyId])
                        }
                        loading={isAdding}
                        disabled={!propertyId || isAdding}
                    >
                        Add
                    </Button>
                );
            },
        },
    ];

    // Row selection config for table
    const rowSelection = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
        getCheckboxProps: (record: PropertyRecommendation) => ({
            disabled: isPropertyInDeal(record.property?.id || null),
            name: record.property?.title,
        }),
    };

    // Get selected property IDs for bulk add
    const selectedPropertyIds = useMemo(() => {
        return selectedRowKeys
            .map((key) => {
                const rec = recommendations.find((r) => r.rank === key);
                return rec?.property?.id;
            })
            .filter((id): id is number => id !== undefined);
    }, [selectedRowKeys, recommendations]);

    // Render loading skeleton
    if (isLoading) {
        return (
            <div className="p-6">
                <Row gutter={[16, 16]}>
                    {[1, 2, 3, 4].map((i) => (
                        <Col xs={24} sm={24} lg={24} key={i}>
                            <Card>
                                <Skeleton active paragraph={{ rows: 3 }} />
                            </Card>
                        </Col>
                    ))}
                </Row>
            </div>
        );
    }

    // Render error state
    if (apiError && recommendations.length === 0) {
        return (
            <div className="p-6">
                <Alert
                    message="Please complete the deal information to generate property recommendations."
                    description={apiError}
                    type="warning"
                    showIcon
                    action={
                        <Button size="small" onClick={() => refetch()}>
                            Try Again
                        </Button>
                    }
                />
            </div>
        );
    }

    // Render empty state
    if (!isLoading && recommendations.length === 0) {
        return (
            <div className="p-8">
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                        <div className="text-center">
                            <p className="text-gray-500 mb-2">
                                No property recommendations available
                            </p>
                            <Text type="secondary">
                                Recommendations are generated based on customer
                                preferences and property matching algorithms.
                            </Text>
                        </div>
                    }
                >
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={handleRefresh}
                        loading={loading}
                    >
                        Generate Recommendations
                    </Button>
                </Empty>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header with refresh action */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <Title level={5} style={{ margin: 0 }}>
                        Property Recommendations
                    </Title>
                    <Text type="secondary">
                        Based on customer preferences and AI matching
                    </Text>
                </div>
                <Space>
                    {cached && (
                        <Tooltip title="Results are cached for performance">
                            <Tag icon={<InfoCircleOutlined />} color="blue">
                                Cached
                            </Tag>
                        </Tooltip>
                    )}
                    <Segmented
                        options={[
                            {
                                value: "cards",
                                icon: <AppstoreOutlined />,
                            },
                            {
                                value: "table",
                                icon: <UnorderedListOutlined />,
                            },
                        ]}
                        value={viewMode}
                        onChange={(value) => setViewMode(value as ViewMode)}
                    />
                    <Button
                        icon={<ReloadOutlined spin={loading} />}
                        onClick={handleRefresh}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </Space>
            </div>

            {/* Error banner (if we have results but also an error) */}
            {apiError && (
                <Alert
                    message={apiError}
                    type="warning"
                    showIcon
                    className="mb-4"
                    closable
                />
            )}

            {/* Bulk action bar for table view */}
            {viewMode === "table" && selectedRowKeys.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <Text>
                        <strong>{selectedRowKeys.length}</strong>{" "}
                        {selectedRowKeys.length === 1
                            ? "property"
                            : "properties"}{" "}
                        selected
                    </Text>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() =>
                            handleAddPropertiesToDeal(selectedPropertyIds)
                        }
                        loading={addingPropertyIds.size > 0}
                    >
                        Add Selected to Deal
                    </Button>
                </div>
            )}

            {/* Table View */}
            {viewMode === "table" && (
                <DataTable
                    rowSelection={rowSelection}
                    columns={tableColumns}
                    dataSource={recommendations}
                    rowKey="rank"
                    scroll={{ x: "max-content" }}
                    size="middle"
                />
            )}

            {/* Card View */}
            {viewMode === "cards" && (
                <Row gutter={[16, 16]}>
                    {recommendations.map((rec) => (
                        <Col xs={24} sm={24} lg={24} xl={24} key={rec.rank}>
                            <RecommendationCard
                                recommendation={rec}
                                propertyHref={getPropertyShowHref(
                                    rec.property?.id || null,
                                )}
                                formatPrice={formatPrice}
                                getMatchColor={getMatchColor}
                                getStatusColor={getStatusColor}
                                getFactorColor={getFactorColor}
                                getFactorIcon={getFactorIcon}
                                isInDeal={isPropertyInDeal(
                                    rec.property?.id || null,
                                )}
                                onAddToDeal={() =>
                                    rec.property?.id &&
                                    handleAddPropertiesToDeal([rec.property.id])
                                }
                                isAdding={isPropertyAdding(
                                    rec.property?.id || null,
                                )}
                            />
                        </Col>
                    ))}
                </Row>
            )}
        </div>
    );
}

/**
 * Individual recommendation card component
 */
interface RecommendationCardProps {
    recommendation: PropertyRecommendation;
    propertyHref: string | null;
    formatPrice: (price: number | null | undefined) => string;
    getMatchColor: (percentage: number | null) => string;
    getStatusColor: (status: string) => string;
    getFactorColor: (score: number | null | undefined) => string;
    getFactorIcon: (score: number | null | undefined) => React.ReactNode;
    isInDeal: boolean;
    onAddToDeal: () => void;
    isAdding: boolean;
}

function RecommendationCard({
    recommendation,
    propertyHref,
    formatPrice,
    getMatchColor,
    getStatusColor,
    getFactorColor,
    getFactorIcon,
    isInDeal,
    onAddToDeal,
    isAdding,
}: RecommendationCardProps) {
    const { property, match_percentage, rank, factors } = recommendation;
    const [imageError, setImageError] = useState(false);

    const hasImage = property?.primary_photo && !imageError;

    return (
        <Card
            hoverable
            className="recommendation-card h-full"
            cover={
                <div className="relative">
                    {/* Rank badge */}
                    <div
                        className="absolute top-2 left-2 z-10 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md"
                        style={{ fontWeight: "bold" }}
                    >
                        #{rank}
                    </div>

                    {/* Match percentage badge */}
                    {match_percentage !== null && (
                        <div className="absolute top-2 right-2 z-10">
                            <Progress
                                type="circle"
                                percent={match_percentage}
                                width={50}
                                strokeColor={getMatchColor(match_percentage)}
                                format={(percent) => (
                                    <span style={{ fontSize: 10 }}>
                                        {percent}%
                                    </span>
                                )}
                            />
                        </div>
                    )}

                    {/* Property image or placeholder */}
                    {hasImage ? (
                        <img
                            src={property.primary_photo!}
                            alt={property?.title || `Property #${rank}`}
                            style={{
                                height: 150,
                                width: "100%",
                                objectFit: "cover",
                            }}
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <div
                            className="flex items-center justify-center bg-gray-100"
                            style={{ height: 150, width: "100%" }}
                        >
                            <HomeOutlined
                                style={{ fontSize: 48, color: "#d9d9d9" }}
                            />
                        </div>
                    )}
                </div>
            }
        >
            <Card.Meta
                title={
                    <div className="flex items-center justify-between">
                        {propertyHref ? (
                            <Link href={propertyHref} target="_blank">
                                <Text
                                    strong
                                    ellipsis
                                    style={{ maxWidth: "70%" }}
                                    title={property?.title}
                                >
                                    {property?.title || `Property #${rank}`}
                                </Text>
                            </Link>
                        ) : (
                            <Text
                                strong
                                ellipsis
                                style={{ maxWidth: "70%" }}
                                title={property?.title}
                            >
                                {property?.title || `Property #${rank}`}
                            </Text>
                        )}
                        {property?.status && (
                            <Tag
                                color={getStatusColor(property.status)}
                                style={{ marginRight: 0 }}
                            >
                                {property.status}
                            </Tag>
                        )}
                    </div>
                }
                description={
                    <div className="space-y-2 mt-2">
                        {/* Property type & sale type */}
                        {property && (
                            <div className="flex items-center text-gray-600">
                                <HomeOutlined className="mr-2" />
                                <Text type="secondary" className="capitalize">
                                    {property.property_type?.replace("_", " ")}{" "}
                                    for {property.sale_type}
                                </Text>
                            </div>
                        )}

                        {/* Location */}
                        {property?.city && (
                            <div className="flex items-center text-gray-600">
                                <EnvironmentOutlined className="mr-2" />
                                <Text type="secondary" ellipsis>
                                    {property.area ? `${property.area}, ` : ""}
                                    {property.city}
                                </Text>
                            </div>
                        )}

                        {/* Price */}
                        {property?.price && (
                            <div className="flex items-center">
                                <DollarOutlined className="mr-2" />
                                <Text strong style={{ color: "#1890ff" }}>
                                    {formatPrice(property.price)}
                                </Text>
                            </div>
                        )}

                        {/* Bedrooms & Bathrooms */}
                        {(property?.bedrooms || property?.bathrooms) && (
                            <div className="flex items-center gap-4 text-gray-500 text-sm">
                                {property.bedrooms && (
                                    <span>{property.bedrooms} Beds</span>
                                )}
                                {property.bathrooms && (
                                    <span>{property.bathrooms} Baths</span>
                                )}
                            </div>
                        )}

                        {/* Match factors */}
                        {factors && factors.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Match factors:
                                </Text>
                                <div className="flex flex-col gap-1 mt-1">
                                    {factors.map((factor, idx) => (
                                        <Tooltip
                                            key={idx}
                                            title={
                                                factor.detail || factor.status
                                            }
                                        >
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="flex items-center gap-1">
                                                    {getFactorIcon(
                                                        factor.score,
                                                    )}
                                                    <span className="capitalize">
                                                        {factor.name}
                                                    </span>
                                                </span>
                                                <Tag
                                                    color={getFactorColor(
                                                        factor.score,
                                                    )}
                                                    style={{
                                                        fontSize: 10,
                                                        margin: 0,
                                                    }}
                                                >
                                                    {factor.status ||
                                                        `${factor.score}%`}
                                                </Tag>
                                            </div>
                                        </Tooltip>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add to Deal button */}
                        <div className="mt-3 pt-2 border-t border-gray-100">
                            {isInDeal ? (
                                <Tag
                                    color="green"
                                    icon={<CheckCircleOutlined />}
                                    className="w-full text-center"
                                    style={{ padding: "4px 8px" }}
                                >
                                    Added to Deal
                                </Tag>
                            ) : (
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    size="small"
                                    block
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddToDeal();
                                    }}
                                    loading={isAdding}
                                    disabled={!property?.id || isAdding}
                                >
                                    Add to Deal
                                </Button>
                            )}
                        </div>
                    </div>
                }
            />
        </Card>
    );
}
