import React from "react";
import { Typography, Tag, Space, Button } from "antd";
import {
    EditOutlined,
    ShareAltOutlined,
    EnvironmentOutlined,
    HomeOutlined,
    DollarOutlined,
    FilePdfOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import { getStatusColor, formatCurrency } from "@/lib/utils";

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
    return (
        <div className="mb-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <Title level={2} className="mb-0">
                            {property.title}
                        </Title>
                        <Tag
                            color={getStatusColor(property.status)}
                            className="text-sm px-3 py-1"
                        >
                            {property.status}
                        </Tag>
                    </div>

                    <div className="flex items-center gap-4 mb-3 text-gray-600">
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
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <Title level={3} className="mb-0 text-blue-600">
                            {formatCurrency(property.price)}
                        </Title>
                        {property.sale_type.includes("Rent") && (
                            <Text type="secondary">
                                / {property.rent_payment_interval || "month"}
                            </Text>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onGenerateExpose && (
                        <Button
                            icon={<FilePdfOutlined />}
                            onClick={onGenerateExpose}
                        >
                            Generate Expose
                        </Button>
                    )}
                    {canEdit && (
                        <Button
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={onEdit}
                        >
                            Edit Property
                        </Button>
                    )}
                    {/* <Button icon={<ShareAltOutlined />} onClick={onShare}>
                        Share
                    </Button> */}
                </div>
            </div>
        </div>
    );
}

export default PropertyHeader;
