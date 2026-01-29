import React from "react";
import { Card, Typography, Button, Tag } from "antd";
import { EnvironmentOutlined, ProjectOutlined } from "@ant-design/icons";
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
                        {area}, {city}
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
}
