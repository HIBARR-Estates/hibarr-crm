import React from "react";
import { Card, Descriptions, Tag } from "antd";
import { Property } from "@/Types";
import { getStatusColor } from "@/lib/utils";

interface PropertySpecificationsProps {
    property: Property;
}

export default function PropertySpecifications({
    property,
}: PropertySpecificationsProps) {
    return (
        <Card title="Specifications" className="mb-6">
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="middle">
                <Descriptions.Item label="Property Type">
                    {property.property_type}
                </Descriptions.Item>
                <Descriptions.Item label="Sale Type">
                    {property.sale_type}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={getStatusColor(property.status)}>
                        {property.status}
                    </Tag>
                </Descriptions.Item>
                {property.floor_number && (
                    <Descriptions.Item label="Floor Number">
                        {property.floor_number}
                    </Descriptions.Item>
                )}
                {property.floors_in_building && (
                    <Descriptions.Item label="Total Floors">
                        {property.floors_in_building}
                    </Descriptions.Item>
                )}
                {property.furniture_status && (
                    <Descriptions.Item label="Furniture Status">
                        {property.furniture_status}
                    </Descriptions.Item>
                )}
                {property.within_site && (
                    <Descriptions.Item label="Within Site/Complex">
                        <Tag color="green">Yes</Tag>
                    </Descriptions.Item>
                )}
            </Descriptions>
        </Card>
    );
}