import React from "react";
import { Card, Typography, Button, Space } from "antd";
import {
    FileTextOutlined,
    VideoCameraOutlined,
    EyeOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";

const { Paragraph, Text } = Typography;

interface DescriptionMediaCardProps {
    property: Property;
}

export default function DescriptionMediaCard({
    property,
}: DescriptionMediaCardProps) {
    // Get video and tour from assets or fallback to legacy fields
    const videoAssets =
        property.assets?.filter(
            (a) => a.asset_type === "video_url" || a.asset_type === "video",
        ) || [];
    const tourAssets =
        property.assets?.filter((a) => a.asset_type === "tour_360_url") || [];

    const videoUrl =
        videoAssets[0]?.external_url ||
        videoAssets[0]?.url ||
        property.video_url;
    const tourUrl =
        tourAssets[0]?.external_url ||
        tourAssets[0]?.url ||
        property.tour_360_url;

    const hasDescription = !!property.description;
    const hasMedia = !!videoUrl || !!tourUrl;

    if (!hasDescription && !hasMedia) return null;

    return (
        <Card
            title={
                <span>
                    <FileTextOutlined className="mr-2" />
                    Description & Media
                </span>
            }
            variant="outlined"
            size="small"
        >
            {hasDescription && (
                <Paragraph
                    className="text-gray-700 text-sm leading-relaxed mb-4"
                    ellipsis={{ rows: 4, expandable: true, symbol: "Read more" }}
                >
                    {property.description}
                </Paragraph>
            )}

            {hasMedia && (
                <div className="flex flex-wrap gap-3">
                    {videoUrl && (
                        <Button
                            icon={<VideoCameraOutlined />}
                            href={videoUrl}
                            target="_blank"
                        >
                            Watch Video
                        </Button>
                    )}
                    {tourUrl && (
                        <Button
                            icon={<EyeOutlined />}
                            href={tourUrl}
                            target="_blank"
                        >
                            360° Virtual Tour
                        </Button>
                    )}
                </div>
            )}
        </Card>
    );
}
