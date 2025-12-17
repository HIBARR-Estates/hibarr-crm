import React from "react";
import { Card, Row, Col, Typography, Button } from "antd";
import { VideoCameraOutlined, EyeOutlined } from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface PropertyMediaProps {
    property: Property;
}

export default function PropertyMedia({ property }: PropertyMediaProps) {
    // Get video and tour assets from the new PropertyAsset system
    const videoAssets = property.assets?.filter(asset => 
        asset.asset_type === 'video_url' || asset.asset_type === 'video'
    ) || [];
    const tourAssets = property.assets?.filter(asset => 
        asset.asset_type === 'tour_360_url'
    ) || [];
    
    // Fallback to old properties for backward compatibility
    const hasVideoUrl = property.video_url || videoAssets.length > 0;
    const hasTourUrl = property.tour_360_url || tourAssets.length > 0;
    const hasMedia = hasVideoUrl || hasTourUrl;

    if (!hasMedia) return null;

    return (
        <Card title="Media" className="mb-6">
            <Row gutter={[16, 16]}>
                {/* Video from assets or fallback to old property.video_url */}
                {(videoAssets.length > 0 || property.video_url) && (
                    <Col xs={24} sm={12}>
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <VideoCameraOutlined className="text-blue-600" />
                                <Text strong>Property Video</Text>
                            </div>
                            <Button
                                type="primary"
                                href={videoAssets[0]?.external_url || videoAssets[0]?.url || property.video_url}
                                target="_blank"
                                block
                            >
                                Watch Video
                            </Button>
                        </div>
                    </Col>
                )}

                {/* 360 Tour from assets or fallback to old property.tour_360_url */}
                {(tourAssets.length > 0 || property.tour_360_url) && (
                    <Col xs={24} sm={12}>
                        <div className="p-4 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <EyeOutlined className="text-blue-600" />
                                <Text strong>360° Virtual Tour</Text>
                            </div>
                            <Button
                                type="primary"
                                href={tourAssets[0]?.external_url || tourAssets[0]?.url || property.tour_360_url}
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