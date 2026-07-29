import React from "react";
import { Card, Avatar, Typography, Space, Divider, Empty } from "antd";
import {
    UserOutlined,
    TeamOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import { formatCompanyDate } from "@/lib/companyDateTime";

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
                {property.addedBy ? (
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
                ) : (
                    <div className="flex items-center gap-3">
                        <Avatar icon={<UserOutlined />} size="small" />
                        <div className="flex-1 min-w-0">
                            <Text className="text-sm block truncate">
                                {`No agent created this property`}
                            </Text>
                            <Text type="secondary" className="text-xs">
                                Added by
                            </Text>
                        </div>
                    </div>
                )}

                {/* Responsible agent */}
                {property.responsible_agent ? (
                    <>
                        {property.added_by && <Divider className="my-2" />}
                        <div className="flex items-center gap-3">
                            <Avatar
                                src={property.responsible_agent.image_url}
                                icon={<TeamOutlined />}
                                size="small"
                            />
                            <div className="flex-1 min-w-0">
                                <Text className="text-sm block truncate">
                                    {property.responsible_agent.name}
                                </Text>
                                <Text type="secondary" className="text-xs">
                                    Responsible Agent
                                </Text>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-3">
                        <Avatar icon={<UserOutlined />} size="small" />
                        <div className="flex-1 min-w-0">
                            <Text className="text-sm block truncate">
                                {`No agent assigned`}
                            </Text>
                            <Text type="secondary" className="text-xs">
                                Responsible Agent
                            </Text>
                        </div>
                    </div>
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
                        {formatCompanyDate(property.created_at)}
                    </Text>
                </div>
            </div>
        </Card>
    );
}
