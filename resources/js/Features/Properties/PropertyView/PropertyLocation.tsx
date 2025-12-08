import React from "react";
import { Card, Typography, Button } from "antd";
import { EnvironmentOutlined } from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface PropertyLocationProps {
    property: Property;
}

export default function PropertyLocation({ property }: PropertyLocationProps) {
    return (
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
}