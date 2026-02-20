import React from "react";
import { Card, Typography, Button, Tag } from "antd";
import {
    EnvironmentOutlined,
    ProjectOutlined,
    HomeOutlined,
    NumberOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface PropertyLocationProps {
    property: Property;
}

export default function PropertyLocation({ property }: PropertyLocationProps) {
    // Use effective_location which derives from project location or falls back to direct values
    const city = property.effective_location?.city ?? property.city;
    const area = property.effective_location?.area ?? property.area;

    return (
        <Card title="Location" className="mb-6">
            <div className="mb-4">
                {/* Show project badge if location is derived from project */}
                {property.has_project_location && property.developerProject && (
                    <div className="mb-3">
                        <Tag icon={<ProjectOutlined />} color="blue">
                            From: {property.developerProject.name}
                        </Tag>
                    </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                    <EnvironmentOutlined className="text-blue-600" />
                    <Text strong>
                        {area ? `${area}, ` : "No location specified"}
                        {city}
                    </Text>
                </div>

                {/* Block and Unit information */}
                {(property.block_name || property.unit_number) && (
                    <div className="flex items-center gap-4 mt-3 text-gray-600">
                        {property.block_name && (
                            <div className="flex items-center gap-1">
                                <HomeOutlined />
                                <Text type="secondary">
                                    {property.block_name}
                                </Text>
                            </div>
                        )}
                        {property.unit_number && (
                            <div className="flex items-center gap-1">
                                <NumberOutlined />
                                <Text type="secondary">
                                    Unit {property.unit_number}
                                </Text>
                            </div>
                        )}
                    </div>
                )}

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
}
