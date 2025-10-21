import React from "react";
import { Card, Typography } from "antd";
import { Property } from "@/Types";

const { Text } = Typography;

interface QuickFactsProps {
    property: Property;
}

export default function QuickFacts({ property }: QuickFactsProps) {
    // console.log("created at", property.created_at, "prop", property);
    return (
        <Card title="Property Details" size="small">
            <div className="space-y-2">
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
                {property.land_size && (
                    <div className="flex justify-between">
                        <Text type="secondary">Land Size:</Text>
                        <Text>{property.land_size} m²</Text>
                    </div>
                )}
            </div>
        </Card>
    );
}
