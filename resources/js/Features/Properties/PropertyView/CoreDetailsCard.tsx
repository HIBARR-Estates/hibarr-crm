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
                <Descriptions.Item label="Property Type" className="capitalize">
                    {property.property_type.split("_").join(" ")}
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
                {property.unit_style && property.unit_style.length > 0 && (
                    <Descriptions.Item label="Unit Style">
                        <div className="flex flex-wrap gap-1">
                            {property.unit_style.map((style) => (
                                <Tag key={style} className="capitalize">
                                    {style.replace(/_/g, " ")}
                                </Tag>
                            ))}
                        </div>
                    </Descriptions.Item>
                )}
            </Descriptions>
        </Card>
    );
}
