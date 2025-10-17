import React from "react";
import { Card, Row, Col, Typography } from "antd";
import {
    CarOutlined,
    WifiOutlined,
    FireOutlined,
    SecurityScanOutlined,
    HomeOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface PropertyFeaturesProps {
    property: Property;
}

export default function PropertyFeatures({ property }: PropertyFeaturesProps) {
    const features = [
        ...(property.exterior_features || []),
        ...(property.interior_features || []),
        ...(property.location_features || []),
    ];

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
    };

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
}