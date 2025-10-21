import React from "react";
import { Card, Avatar, Typography, Space, Button } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface ContactInfoProps {
    property: Property;
}

export default function ContactInfo({ property }: ContactInfoProps) {
    return (
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
    );
}