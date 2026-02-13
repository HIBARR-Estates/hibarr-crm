import React from "react";
import { Card, Avatar, Typography, Space, Divider } from "antd";
import {
    UserOutlined,
    TeamOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface AgentInfoCardProps {
    property: Property;
}

export default function AgentInfoCard({ property }: AgentInfoCardProps) {
    return (
        <Card
            title={
                <span>
                    <TeamOutlined className="mr-2" />
                    Agent Info
                </span>
            }
            variant="outlined"
            size="small"
        >
            <div className="space-y-3">
                {/* Added by */}
                {property.addedBy && (
                    <div className="flex items-center gap-3">
                        <Avatar
                            src={property.addedBy.image_url}
                            icon={<UserOutlined />}
                            size="small"
                        />
                        <div className="flex-1 min-w-0">
                            <Text className="text-sm block truncate">
                                {property.addedBy.name}
                            </Text>
                            <Text type="secondary" className="text-xs">
                                Added by
                            </Text>
                        </div>
                    </div>
                )}

                {/* Responsible agent */}
                {property.responsibleAgent && (
                    <>
                        {property.addedBy && <Divider className="my-2" />}
                        <div className="flex items-center gap-3">
                            <Avatar
                                src={property.responsibleAgent.image_url}
                                icon={<TeamOutlined />}
                                size="small"
                            />
                            <div className="flex-1 min-w-0">
                                <Text className="text-sm block truncate">
                                    {property.responsibleAgent.name}
                                </Text>
                                <Text type="secondary" className="text-xs">
                                    Responsible Agent
                                </Text>
                            </div>
                        </div>
                    </>
                )}

                <Divider className="my-2" />

                {/* Listed date */}
                <div className="flex justify-between items-center">
                    <Space>
                        <CalendarOutlined className="text-gray-400" />
                        <Text type="secondary" className="text-xs">
                            Listed
                        </Text>
                    </Space>
                    <Text className="text-xs">
                        {new Date(property.created_at).toLocaleDateString()}
                    </Text>
                </div>
            </div>
        </Card>
    );
}
