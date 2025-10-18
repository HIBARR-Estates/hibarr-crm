import React from "react";
import { Card, Row, Col, Typography, Divider } from "antd";
import {
    CarOutlined,
    WifiOutlined,
    FireOutlined,
    SecurityScanOutlined,
    HomeOutlined,
    EnvironmentOutlined,
    AppstoreOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";

const { Text, Title } = Typography;

interface PropertyFeaturesProps {
    property: Property;
}

interface FeatureListProps {
    features: string[];
    title: string;
    icon: React.ReactNode;
}

function FeatureList({ features, title, icon }: FeatureListProps) {
    // Property features icons mapping
    const featureIcons: Record<string, React.ReactNode> = {
        Parking: <CarOutlined />,
        WiFi: <WifiOutlined />,
        "Air Conditioning": <FireOutlined />,
        Security: <SecurityScanOutlined />,
        Garden: <HomeOutlined />,
        Pool: <HomeOutlined />,
        Gym: <HomeOutlined />,
        Balcony: <HomeOutlined />,
        Garage: <HomeOutlined />,
        Terrace: <HomeOutlined />,
        "Swimming Pool": <HomeOutlined />,
        "Sea View": <EnvironmentOutlined />,
        "Mountain View": <EnvironmentOutlined />,
        "City View": <EnvironmentOutlined />,
        "Near Beach": <EnvironmentOutlined />,
        "Near Schools": <EnvironmentOutlined />,
        "Near Shopping": <EnvironmentOutlined />,
        "Public Transport": <EnvironmentOutlined />,
        Kitchen: <HomeOutlined />,
        "Built-in Wardrobes": <HomeOutlined />,
        Fireplace: <FireOutlined />,
        "Ensuite Bathroom": <HomeOutlined />,
    };

    if (!features || features.length === 0) return null;

    return (
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-blue-600">{icon}</span>
                <Title level={5} className="mb-0">
                    {title}
                </Title>
            </div>
            <Row gutter={[12, 12]}>
                {features.map((feature, index) => (
                    <Col key={index} xs={12} sm={8} lg={6}>
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md border">
                            <span className="text-gray-600 text-sm">
                                {featureIcons[feature] || <HomeOutlined />}
                            </span>
                            <Text className="text-sm">{feature}</Text>
                        </div>
                    </Col>
                ))}
            </Row>
        </div>
    );
}

export default function PropertyFeatures({ property }: PropertyFeaturesProps) {
    const hasAnyFeatures =
        (property.exterior_features && property.exterior_features.length > 0) ||
        (property.interior_features && property.interior_features.length > 0) ||
        (property.location_features && property.location_features.length > 0) ||
        (property.add_ons && property.add_ons.length > 0);

    if (!hasAnyFeatures) return null;

    return (
        <Card title="Property Features" className="mb-6">
            <FeatureList
                features={property.exterior_features || []}
                title="Exterior Features"
                icon={<HomeOutlined />}
            />

            <FeatureList
                features={property.interior_features || []}
                title="Interior Features"
                icon={<AppstoreOutlined />}
            />

            <FeatureList
                features={property.location_features || []}
                title="Location Features"
                icon={<EnvironmentOutlined />}
            />

            <FeatureList
                features={property.add_ons || []}
                title="Add-Ons"
                icon={<PlusOutlined />}
            />
        </Card>
    );
}
