import { Deal } from "@/Types/api/deals";
import {
    PropertyRecommendation,
    RecommendationsResponse,
} from "@/Types/api/property-recommendation";
import {
    Empty,
    Button,
    Spin,
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
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

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
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [recommendations, setRecommendations] = useState<
        PropertyRecommendation[]
    >([]);
    const [cached, setCached] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Fetch recommendations from the API
    const fetchRecommendations = useCallback(
        async (refresh = false) => {
            if (refresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            try {
                const endpoint = refresh
                    ? route("deals.recommendations.refresh", { deal: deal.id })
                    : route("deals.recommendations.index", { deal: deal.id });

                const response = await axios.request<RecommendationsResponse>({
                    method: refresh ? "POST" : "GET",
                    url: endpoint,
                    params: { limit: 10 },
                });

                if (response.data.status === "success") {
                    setRecommendations(response.data.recommendations);
                    setCached(response.data.cached);
                    setError(null);
                } else {
                    setError(
                        response.data.error || "Failed to fetch recommendations"
                    );
                }
            } catch (err: any) {
                console.error("Failed to fetch recommendations:", err);
                setError(
                    err.response?.data?.error ||
                        err.message ||
                        "Failed to fetch recommendations"
                );
            } finally {
                setLoading(false);
                setRefreshing(false);
                setHasLoaded(true);
            }
        },
        [deal.id]
    );

    // Load recommendations on mount
    useEffect(() => {
        if (!hasLoaded) {
            fetchRecommendations();
        }
    }, [fetchRecommendations, hasLoaded]);

    // Handle refresh
    const handleRefresh = () => {
        fetchRecommendations(true);
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
    if (loading) {
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
    if (error && recommendations.length === 0) {
        return (
            <div className="p-6">
                <Alert
                    message="Unable to Load Recommendations"
                    description={error}
                    type="warning"
                    showIcon
                    action={
                        <Button
                            size="small"
                            onClick={() => fetchRecommendations()}
                        >
                            Try Again
                        </Button>
                    }
                />
            </div>
        );
    }

    // Render empty state
    if (!loading && recommendations.length === 0) {
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
                        loading={refreshing}
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
                        icon={<ReloadOutlined spin={refreshing} />}
                        onClick={handleRefresh}
                        loading={refreshing}
                    >
                        Refresh
                    </Button>
                </Space>
            </div>

            {/* Error banner (if we have results but also an error) */}
            {error && (
                <Alert
                    message={error}
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
                        <Text
                            strong
                            ellipsis
                            style={{ maxWidth: "70%" }}
                            title={property?.title}
                        >
                            {property?.title || `Property #${rank}`}
                        </Text>
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
