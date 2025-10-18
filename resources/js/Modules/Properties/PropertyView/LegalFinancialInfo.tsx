import React from "react";
import { Card, Descriptions } from "antd";
import { Property } from "@/Types";

interface LegalFinancialInfoProps {
    property: Property;
}

export default function LegalFinancialInfo({
    property,
}: LegalFinancialInfoProps) {
    const hasLegalInfo =
        property.title_deed_type ||
        property.title_deed_stage ||
        property.minimal_rental_period ||
        property.rent_payment_interval;

    if (!hasLegalInfo) return null;

    return (
        <Card title="Legal & Financial Information" className="mb-6">
            <Descriptions column={{ xs: 1, sm: 2 }} size="middle">
                {property.title_deed_type && (
                    <Descriptions.Item label="Title Deed Type">
                        {property.title_deed_type}
                    </Descriptions.Item>
                )}
                {property.title_deed_stage && (
                    <Descriptions.Item label="Title Deed Stage">
                        {property.title_deed_stage}
                    </Descriptions.Item>
                )}
                {property.minimal_rental_period && (
                    <Descriptions.Item label="Minimum Rental Period">
                        {property.minimal_rental_period}
                    </Descriptions.Item>
                )}
                {property.rent_payment_interval && (
                    <Descriptions.Item label="Payment Interval">
                        {property.rent_payment_interval}
                    </Descriptions.Item>
                )}
            </Descriptions>
        </Card>
    );
}