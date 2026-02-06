import React from "react";
import { Typography, Tag, Space, Button, Tooltip, message } from "antd";
import { router } from "@inertiajs/react";
import {
    EditOutlined,
    ShareAltOutlined,
    EnvironmentOutlined,
    HomeOutlined,
    DollarOutlined,
    FilePdfOutlined,
    FolderOpenOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CopyOutlined,
    GlobalOutlined,
    EyeInvisibleOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import {
    getStatusColor,
    parsePropertyPrice,
    formatCurrencyWithSymbol,
} from "@/lib/utils";
import { usePage } from "@inertiajs/react";
import usePropertyPermissions from "@/Hooks/usePropertyPermissions";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";

const { Title, Text } = Typography;

interface PropertyHeaderProps {
    property: Property;
    onEdit?: () => void;
    onShare?: () => void;
    onGenerateExpose?: () => void;
    canEdit?: boolean;
}

function PropertyHeader({
    property,
    onEdit,
    onShare,
    onGenerateExpose,
    canEdit = false,
}: PropertyHeaderProps) {
    const { props } = usePage<any>();
    const {
        default_currency_code: defaultCurrencyCode,
        default_currency_symbol: defaultCurrencySymbol,
        currencies = [],
    } = props || {};

    const permissions = usePropertyPermissions(property);

    const { amount, currency } = parsePropertyPrice(
        (property as any).price,
        defaultCurrencyCode || "TRY",
    );

    const resolvedSymbol =
        currencies.find((c: any) => c?.currency_code === currency)
            ?.currency_symbol ||
        defaultCurrencySymbol ||
        "";

    // Publish mutation
    const { mutate: publishProperty, isPending: isPublishing } = useApiMutate<
        Record<string, never>,
        { property: Property },
        ApiSuccessResponse<{ property: Property }>
    >(route("properties.publish", property.id), "POST", () => {
        // Refresh the page to get updated property data
        router.reload({ only: ["property"] });
    });

    // Unpublish mutation
    const { mutate: unpublishProperty, isPending: isUnpublishing } =
        useApiMutate<
            Record<string, never>,
            { property: Property },
            ApiSuccessResponse<{ property: Property }>
        >(route("properties.unpublish", property.id), "POST", () => {
            // Refresh the page to get updated property data
            router.reload({ only: ["property"] });
        });

    const handleManageAssets = () => {
        router.visit(route("properties.assets.index", property.id));
    };

    const handleCopyReferenceCode = () => {
        if (property.reference_code) {
            navigator.clipboard.writeText(property.reference_code);
            message.success("Reference code copied to clipboard!");
        }
    };

    const handlePublish = () => {
        publishProperty({});
    };

    const handleUnpublish = () => {
        unpublishProperty({});
    };

    return (
        <div className="mb-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                    {/* Reference Code Badge */}
                    {property.reference_code && (
                        <div className="flex items-center gap-2 mb-2">
                            <Tooltip title="Click to copy reference code">
                                <Tag
                                    color="geekblue"
                                    className="text-xs cursor-pointer hover:opacity-80"
                                    onClick={handleCopyReferenceCode}
                                >
                                    <CopyOutlined className="mr-1" />
                                    {property.reference_code}
                                </Tag>
                            </Tooltip>
                        </div>
                    )}

                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Title level={2} className="mb-0">
                            {property.display_title || property.title}
                        </Title>
                        <Tag
                            color={getStatusColor(property.status)}
                            className="text-sm px-3 py-1"
                        >
                            {property.status}
                        </Tag>
                        {/* Publishing Status Badge */}
                        {property.is_published !== undefined && (
                            <Tooltip
                                title={
                                    property.is_published
                                        ? "Visible to all agents"
                                        : "Only visible to you and admins"
                                }
                            >
                                <Tag
                                    icon={
                                        property.is_published ? (
                                            <GlobalOutlined />
                                        ) : (
                                            <EyeInvisibleOutlined />
                                        )
                                    }
                                    color={
                                        property.is_published
                                            ? "green"
                                            : "orange"
                                    }
                                >
                                    {property.is_published
                                        ? "Published"
                                        : "Draft"}
                                </Tag>
                            </Tooltip>
                        )}
                    </div>

                    <div className="flex items-center gap-4 mb-3 text-gray-600 flex-wrap">
                        <Space>
                            <EnvironmentOutlined />
                            <Text>
                                {property.area}, {property.city}
                            </Text>
                        </Space>
                        <Space>
                            <HomeOutlined />
                            <Text>{property.property_type}</Text>
                        </Space>
                        <Space>
                            <DollarOutlined />
                            <Text>{property.sale_type}</Text>
                        </Space>
                        {property.primary_category && (
                            <Tag color="blue">{property.primary_category}</Tag>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <Title level={3} className="mb-0 text-blue-600">
                            {formatCurrencyWithSymbol(amount, resolvedSymbol)}
                        </Title>
                        {property.sale_type.includes("Rent") && (
                            <Text type="secondary">
                                / {property.rent_payment_interval || "month"}
                            </Text>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Publish/Unpublish Button */}
                    {permissions.canPublish &&
                        (property.is_published ? (
                            <Button
                                icon={<EyeInvisibleOutlined />}
                                onClick={handleUnpublish}
                                loading={isUnpublishing}
                                disabled={isUnpublishing}
                            >
                                Unpublish
                            </Button>
                        ) : (
                            <Button
                                type="primary"
                                ghost
                                icon={<GlobalOutlined />}
                                onClick={handlePublish}
                                loading={isPublishing}
                                disabled={isPublishing}
                            >
                                Publish
                            </Button>
                        ))}
                    <Button
                        icon={<FolderOpenOutlined />}
                        onClick={handleManageAssets}
                    >
                        Manage Assets
                    </Button>
                    {onGenerateExpose && (
                        <Button
                            icon={<FilePdfOutlined />}
                            onClick={onGenerateExpose}
                        >
                            Generate Expose
                        </Button>
                    )}
                    {permissions.canEdit && (
                        <Button
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={onEdit}
                        >
                            Edit Property
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PropertyHeader;
