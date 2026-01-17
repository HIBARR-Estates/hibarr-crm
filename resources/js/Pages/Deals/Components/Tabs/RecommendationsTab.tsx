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
} from "antd";
import {
    ReloadOutlined,
    HomeOutlined,
    EnvironmentOutlined,
    DollarOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@inertiajs/react";

const { Text, Title } = Typography;

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

/**
 * Property Recommendations Tab
 * Displays AI-powered property recommendations based on customer preferences
 */
export default function RecommendationsTab({ deal, permissions }: Props) {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

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
                { limit: 10 }
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

    // Render loading skeleton
    if (isLoading) {
        return (
            <div className="p-6">
                <Row gutter={[16, 16]}>
                    {[1, 2, 3, 4].map((i) => (
                        <Col xs={24} sm={12} lg={6} key={i}>
                            <Card>
                                <Skeleton.Image
                                    active
                                    style={{ width: "100%", height: 150 }}
                                />
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

            {/* Recommendations grid */}
            <Row gutter={[16, 16]}>
                {recommendations.map((rec) => (
                    <Col xs={24} sm={12} lg={8} xl={6} key={rec.rank}>
                        <RecommendationCard
                            recommendation={rec}
                            formatPrice={formatPrice}
                            getMatchColor={getMatchColor}
                            getStatusColor={getStatusColor}
                        />
                    </Col>
                ))}
            </Row>
        </div>
    );
}

/**
 * Individual recommendation card component
 */
interface RecommendationCardProps {
    recommendation: PropertyRecommendation;
    formatPrice: (price: number | null | undefined) => string;
    getMatchColor: (percentage: number | null) => string;
    getStatusColor: (status: string) => string;
}

function RecommendationCard({
    recommendation,
    formatPrice,
    getMatchColor,
    getStatusColor,
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
                        <Link
                            href={route("properties.show", {
                                id: property?.id,
                            })}
                            target="_blank"
                        >
                            <Text
                                strong
                                ellipsis
                                style={{ maxWidth: "70%" }}
                                title={property?.title}
                            >
                                {property?.title || `Property #${rank}`}
                            </Text>
                        </Link>
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

                        {/* Match factors (show top 2) */}
                        {factors && factors.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    Match factors:
                                </Text>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {factors.slice(0, 2).map((factor, idx) => (
                                        <Tag
                                            key={idx}
                                            icon={<CheckCircleOutlined />}
                                            color="green"
                                            style={{ fontSize: 10 }}
                                        >
                                            {factor.name}
                                        </Tag>
                                    ))}
                                    {factors.length > 2 && (
                                        <Tooltip
                                            title={factors
                                                .slice(2)
                                                .map((f) => f.name)
                                                .join(", ")}
                                        >
                                            <Tag style={{ fontSize: 10 }}>
                                                +{factors.length - 2} more
                                            </Tag>
                                        </Tooltip>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                }
            />
        </Card>
    );
}
