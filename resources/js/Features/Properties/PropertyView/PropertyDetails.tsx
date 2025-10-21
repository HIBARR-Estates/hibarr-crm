import React from "react";
import { Card, Row, Col, Typography } from "antd";
import { Property } from "@/Types";

const { Paragraph } = Typography;

interface PropertyDetailsProps {
    property: Property;
}

export default function PropertyDetails({ property }: PropertyDetailsProps) {
    return (
        <Card title="Property Overview">
            <Row gutter={[24, 16]}>
                <Col span={24}>
                    <Paragraph className="text-gray-700 text-base leading-relaxed">
                        {property.description}
                    </Paragraph>
                </Col>
            </Row>
        </Card>
    );
}