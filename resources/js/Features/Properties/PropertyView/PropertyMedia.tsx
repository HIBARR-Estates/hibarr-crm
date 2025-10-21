import React from "react";
import { Card, Row, Col, Typography, Button } from "antd";
import { VideoCameraOutlined, EyeOutlined } from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface PropertyMediaProps {
    property: Property;
}

export default function PropertyMedia({ property }: PropertyMediaProps) {
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
}