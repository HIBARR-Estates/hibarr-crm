import React, { useState } from "react";
import {
    Card,
    Row,
    Col,
    Typography,
    Tag,
    Space,
    Button,
    Descriptions,
    Divider,
    Avatar,
    Empty,
    Tooltip,
} from "antd";
import {
    EditOutlined,
    ShareAltOutlined,
    HeartOutlined,
    EnvironmentOutlined,
    UserOutlined,
    HomeOutlined,
    DollarOutlined,
    VideoCameraOutlined,
    EyeOutlined,
    CarOutlined,
    WifiOutlined,
    FireOutlined,
    SecurityScanOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import PropertyImageGallery from "./PropertyImageGallery";
import PropertyStats from "./PropertyStats";
import AssetsTab from "./AssetsTab";

const { Title, Text, Paragraph } = Typography;

interface Product {
    id: number;
    name: string;
    added_by?: number;
}

interface PropertyViewProps {
    property: Property;
    onEdit?: () => void;
    onShare?: () => void;
    canEdit?: boolean;
}

export default function PropertyView({
    property,
    onEdit,
    onShare,
    canEdit = false,
}: PropertyViewProps) {
    // Format currency
    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Get status color
    const getStatusColor = (status: string): string => {
        const colors: Record<string, string> = {
            Available: "green",
            "Under offer": "orange",
            Sold: "red",
            Rented: "blue",
            Withdrawn: "default",
        };
        return colors[status] || "default";
    };

    // Mock photos for demo (replace with actual property photos)
    const photos =
        property.photos && property.photos?.length > 0
            ? property.photos
            : [
                  "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
                  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
                  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
              ];

    // Property features icons mapping
    const featureIcons: Record<string, any> = {
        Parking: <CarOutlined />,
        WiFi: <WifiOutlined />,
        "Air Conditioning": <FireOutlined />,
        Security: <SecurityScanOutlined />,
        Garden: <HomeOutlined />,
        Pool: <HomeOutlined />,
        Gym: <HomeOutlined />,
        Balcony: <HomeOutlined />,
    };

    const renderPropertyHeader = () => (
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
                    {canEdit && (
                        <Button
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={onEdit}
                        >
                            Edit Property
                        </Button>
                    )}
                    <Button icon={<ShareAltOutlined />} onClick={onShare}>
                        Share
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderImageGallery = () => (
        <Card>
            <PropertyImageGallery images={photos} title={property.title} />
        </Card>
    );

    const renderPropertyDetails = () => (
        <Card title="Property Overview">
            <Row gutter={[24, 16]}>
                <Col span={24}>
                    <Paragraph className="text-gray-700 text-base leading-relaxed">
                        {property.description}
                    </Paragraph>
                </Col>
            </Row>
        </Card>
    );

    const renderFeatures = () => {
        const features = [
            ...(property.exterior_features || []),
            ...(property.interior_features || []),
            ...(property.location_features || []),
        ];

        if (features.length === 0) return null;

        return (
            <Card title="Property Features" className="mb-6">
                <Row gutter={[16, 16]}>
                    {features.map((feature, index) => (
                        <Col key={index} xs={12} sm={8} md={6}>
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                                <span className="text-blue-600">
                                    {featureIcons[feature] || <HomeOutlined />}
                                </span>
                                <Text>{feature}</Text>
                            </div>
                        </Col>
                    ))}
                </Row>
            </Card>
        );
    };

    const renderSpecifications = () => (
        <Card title="Specifications" className="mb-6">
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="middle">
                <Descriptions.Item label="Property Type">
                    {property.property_type}
                </Descriptions.Item>
                <Descriptions.Item label="Sale Type">
                    {property.sale_type}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={getStatusColor(property.status)}>
                        {property.status}
                    </Tag>
                </Descriptions.Item>
                {property.floor_number && (
                    <Descriptions.Item label="Floor Number">
                        {property.floor_number}
                    </Descriptions.Item>
                )}
                {property.floors_in_building && (
                    <Descriptions.Item label="Total Floors">
                        {property.floors_in_building}
                    </Descriptions.Item>
                )}
                {property.furniture_status && (
                    <Descriptions.Item label="Furniture Status">
                        {property.furniture_status}
                    </Descriptions.Item>
                )}
                {property.within_site && (
                    <Descriptions.Item label="Within Site/Complex">
                        <Tag color="green">Yes</Tag>
                    </Descriptions.Item>
                )}
            </Descriptions>
        </Card>
    );

    const renderLegalFinancial = () => (
        <Card title="Legal & Financial Information" className="mb-6">
            <Descriptions column={{ xs: 1, sm: 2 }} size="middle">
                {property.title_deed_type && (
                    <Descriptions.Item label="Title Deed Type">
                        {property.title_deed_type}
                    </Descriptions.Item>
                )}
                {property.title_deed_stage && (
                    <Descriptions.Item label="Title Deed Stage">
                        {property.title_deed_stage}
                    </Descriptions.Item>
                )}
                {property.minimal_rental_period && (
                    <Descriptions.Item label="Minimum Rental Period">
                        {property.minimal_rental_period}
                    </Descriptions.Item>
                )}
                {property.rent_payment_interval && (
                    <Descriptions.Item label="Payment Interval">
                        {property.rent_payment_interval}
                    </Descriptions.Item>
                )}
            </Descriptions>
        </Card>
    );

    const renderLocation = () => (
        <Card title="Location" className="mb-6">
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <EnvironmentOutlined className="text-blue-600" />
                    <Text strong>
                        {property.area}, {property.city}
                    </Text>
                </div>

                {property.map && (
                    <div className="mt-4">
                        <Button
                            type="link"
                            icon={<EnvironmentOutlined />}
                            href={property.map}
                            target="_blank"
                        >
                            View on Map
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );

    const renderMedia = () => {
        const photos = property.photos || [];
        const hasMedia =
            property.video_url || property.tour_360_url || photos.length > 0;

        if (!hasMedia) return null;

        return (
            <Card title="Media" className="mb-6">
                <Row gutter={[16, 16]}>
                    {property.video_url && (
                        <Col xs={24} sm={12}>
                            <div className="p-4 border rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <VideoCameraOutlined className="text-blue-600" />
                                    <Text strong>Property Video</Text>
                                </div>
                                <Button
                                    type="primary"
                                    href={property.video_url}
                                    target="_blank"
                                    block
                                >
                                    Watch Video
                                </Button>
                            </div>
                        </Col>
                    )}

                    {property.tour_360_url && (
                        <Col xs={24} sm={12}>
                            <div className="p-4 border rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <EyeOutlined className="text-blue-600" />
                                    <Text strong>360° Virtual Tour</Text>
                                </div>
                                <Button
                                    type="primary"
                                    href={property.tour_360_url}
                                    target="_blank"
                                    block
                                >
                                    Take Virtual Tour
                                </Button>
                            </div>
                        </Col>
                    )}
                </Row>
            </Card>
        );
    };

    return (
        <div className="property-view">
            {renderPropertyHeader()}
            {renderImageGallery()}

            <Row gutter={[24, 24]} className="mt-6">
                <Col xs={24} lg={16}>
                    <div className="space-y-6">
                        {renderPropertyDetails()}
                        <PropertyStats property={property} />
                        {renderFeatures()}
                        {renderSpecifications()}
                        {renderLegalFinancial()}
                        <AssetsTab property={property} canEdit={canEdit} />
                    </div>
                </Col>

                <Col xs={24} lg={8} className="space-y-6">
                    <div className="space-y-6">
                        {renderLocation()}

                        {/* Contact Information Card */}
                        <Card title="Contact Information" className="mb-6">
                            <div className="text-center">
                                <Avatar
                                    size={64}
                                    icon={<UserOutlined />}
                                    className="mb-3"
                                />
                                <div className="mb-2">
                                    <Text strong>Real Estate Agent</Text>
                                </div>
                                <div className="mb-4">
                                    <Text type="secondary">
                                        Property ID: {property.id}
                                    </Text>
                                </div>
                                <Space direction="vertical" className="w-full">
                                    <Button type="primary" block>
                                        Contact Agent
                                    </Button>
                                    <Button block>Schedule Viewing</Button>
                                </Space>
                            </div>
                        </Card>

                        {/* Quick Facts Card */}
                        <Card title="Quick Facts" size="small">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Text type="secondary">Listed:</Text>
                                    <Text>
                                        {new Date(
                                            property.created_at
                                        ).toLocaleDateString()}
                                    </Text>
                                </div>
                                <div className="flex justify-between">
                                    <Text type="secondary">Property Type:</Text>
                                    <Text>{property.property_type}</Text>
                                </div>
                                <div className="flex justify-between">
                                    <Text type="secondary">Sale Type:</Text>
                                    <Text>{property.sale_type}</Text>
                                </div>
                                {property.land_size && (
                                    <div className="flex justify-between">
                                        <Text type="secondary">Land Size:</Text>
                                        <Text>{property.land_size} m²</Text>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </Col>
            </Row>
        </div>
    );
}
