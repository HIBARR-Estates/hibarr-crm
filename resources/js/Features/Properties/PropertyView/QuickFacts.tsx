import React from "react";
import { Card, Typography, Tag, Divider, Space, Avatar, Tooltip } from "antd";
import {
    UserOutlined,
    CalendarOutlined,
    HomeOutlined,
    ToolOutlined,
    EyeOutlined,
    TeamOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface QuickFactsProps {
    property: Property;
}

export default function QuickFacts({ property }: QuickFactsProps) {
    return (
        <Card title="Property Details" size="small">
            <div className="space-y-3">
                {/* Reference Code */}
                {property.reference_code && (
                    <div className="flex justify-between items-center">
                        <Text type="secondary">Reference:</Text>
                        <Tag color="geekblue" className="font-mono">
                            {property.reference_code}
                        </Tag>
                    </div>
                )}

                <div className="flex justify-between">
                    <Text type="secondary">Listed:</Text>
                    <Text>
                        {new Date(property.created_at).toLocaleDateString()}
                    </Text>
                </div>

                <div className="flex justify-between">
                    <Text type="secondary">Property Type:</Text>
                    <Text>{property.property_type}</Text>
                </div>

                <div className="flex justify-between">
                    <Text type="secondary">Sale Type:</Text>
                    <Text>{property.sale_type}</Text>
                </div>

                {/* Primary Category */}
                {property.primary_category && (
                    <div className="flex justify-between items-center">
                        <Text type="secondary">Category:</Text>
                        <Tag color="blue">{property.primary_category}</Tag>
                    </div>
                )}

                {/* Unit Style */}
                {property.unit_style && (
                    <div className="flex justify-between items-center">
                        <Text type="secondary">
                            <HomeOutlined className="mr-1" />
                            Unit Style:
                        </Text>
                        <Text>{property.unit_style}</Text>
                    </div>
                )}

                {/* Construction Status */}
                {property.construction_status && (
                    <div className="flex justify-between items-center">
                        <Text type="secondary">
                            <ToolOutlined className="mr-1" />
                            Construction:
                        </Text>
                        <Tag
                            color={
                                property.construction_status ===
                                    "completed_new" ||
                                property.construction_status === "resale"
                                    ? "green"
                                    : property.construction_status ===
                                        "under_construction"
                                      ? "orange"
                                      : property.construction_status ===
                                          "off_plan"
                                        ? "blue"
                                        : "default"
                            }
                        >
                            {property.construction_status.replace(/_/g, " ")}
                        </Tag>
                    </div>
                )}

                {/* View Types */}
                {property.view_types && property.view_types.length > 0 && (
                    <div className="flex justify-between items-start">
                        <Text type="secondary">
                            <EyeOutlined className="mr-1" />
                            Views:
                        </Text>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                            {property.view_types.slice(0, 3).map((view) => (
                                <Tag
                                    key={view}
                                    color="cyan"
                                    className="text-xs"
                                >
                                    {view}
                                </Tag>
                            ))}
                            {property.view_types.length > 3 && (
                                <Tooltip
                                    title={property.view_types
                                        .slice(3)
                                        .join(", ")}
                                >
                                    <Tag className="text-xs">
                                        +{property.view_types.length - 3}
                                    </Tag>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                )}

                {property.land_size && (
                    <div className="flex justify-between">
                        <Text type="secondary">Land Size:</Text>
                        <Text>{property.land_size} m²</Text>
                    </div>
                )}

                {/* Occupancy */}
                {property.current_occupancy && (
                    <div className="flex justify-between items-center">
                        <Text type="secondary">Occupancy:</Text>
                        <Tag
                            color={
                                property.current_occupancy === "vacant"
                                    ? "green"
                                    : "orange"
                            }
                        >
                            {property.current_occupancy}
                        </Tag>
                    </div>
                )}

                <Divider className="my-3" />

                {/* Agent Info */}
                {property.addedBy && (
                    <div className="flex justify-between items-center">
                        <Text type="secondary">
                            <UserOutlined className="mr-1" />
                            Added by:
                        </Text>
                        <Space size="small">
                            {property.addedBy.image_url && (
                                <Avatar
                                    src={property.addedBy.image_url}
                                    size="small"
                                />
                            )}
                            <Text>{property.addedBy.name}</Text>
                        </Space>
                    </div>
                )}

                {property.responsibleAgent && (
                    <div className="flex justify-between items-center">
                        <Text type="secondary">
                            <TeamOutlined className="mr-1" />
                            Responsible:
                        </Text>
                        <Space size="small">
                            {property.responsibleAgent.image_url && (
                                <Avatar
                                    src={property.responsibleAgent.image_url}
                                    size="small"
                                />
                            )}
                            <Text>{property.responsibleAgent.name}</Text>
                        </Space>
                    </div>
                )}

                {/* Delivery Date for off-plan */}
                {property.completion_date && (
                    <div className="flex justify-between items-center">
                        <Text type="secondary">
                            <CalendarOutlined className="mr-1" />
                            Delivery:
                        </Text>
                        <Text>
                            {new Date(
                                property.completion_date,
                            ).toLocaleDateString()}
                        </Text>
                    </div>
                )}
            </div>
        </Card>
    );
}
