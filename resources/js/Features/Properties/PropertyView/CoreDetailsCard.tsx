import React from "react";
import { Card, Descriptions, Tag } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";
import { Property } from "@/Types";

interface CoreDetailsCardProps {
    property: Property;
}

export default function CoreDetailsCard({ property }: CoreDetailsCardProps) {
    return (
        <Card
            title={
                <span>
                    <AppstoreOutlined className="mr-2" />
                    Core Details
                </span>
            }
            variant="outlined"
            size="small"
        >
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
                <Descriptions.Item label="Property Type">
                    {property.property_type}
                </Descriptions.Item>
                <Descriptions.Item label="Sale Type">
                    {property.sale_type}
                </Descriptions.Item>
                {property.primary_category && (
                    <Descriptions.Item label="Category">
                        <Tag color="blue" className="capitalize">
                            {property.primary_category}
                        </Tag>
                    </Descriptions.Item>
                )}
                {property.unit_style && (
                    <Descriptions.Item label="Unit Style">
                        {property.unit_style}
                    </Descriptions.Item>
                )}
            </Descriptions>
        </Card>
    );
}
