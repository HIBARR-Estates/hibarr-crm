import React from "react";
import { Card, Descriptions, Tag, Typography } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { Property } from "@/Types";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface LegalFinancialInfoProps {
    property: Property;
}

export default function LegalFinancialInfo({
    property,
}: LegalFinancialInfoProps) {
    const { td } = useTd();
    const hasLegalInfo =
        property.title_deed_type ||
        property.title_deed_stage ||
        property.minimal_rental_period ||
        property.rent_payment_interval ||
        property.legal_info;

    if (!hasLegalInfo) return null;

    return (
        <Card
            title={
                <span>
                    <SafetyCertificateOutlined className="mr-2" />
                    Legal & Financial
                </span>
            }
            variant="outlined"
            size="small"
        >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                {property.title_deed_type && (
                    <Descriptions.Item label={td("Title Deed Type", { source: "en" })}>
                        {property.title_deed_type}
                    </Descriptions.Item>
                )}
                {property.title_deed_stage && (
                    <Descriptions.Item label={td("Title Deed Stage", { source: "en" })}>
                        {property.title_deed_stage}
                    </Descriptions.Item>
                )}
                {property.legal_info?.deed_status && (
                    <Descriptions.Item label={td("Deed Status", { source: "en" })}>
                        <Tag
                            color={
                                property.legal_info.deed_status ===
                                "developer_ready"
                                    ? "green"
                                    : "orange"
                            }
                        >
                            {property.legal_info.deed_status.replace(/_/g, " ")}
                        </Tag>
                    </Descriptions.Item>
                )}
                {property.legal_info?.military_distance && (
                    <Descriptions.Item label={td("Military Distance", { source: "en" })}>
                        {property.legal_info.military_distance}
                    </Descriptions.Item>
                )}
                {property.legal_info?.has_restrictions !== undefined && (
                    <Descriptions.Item label={td("Has Restrictions", { source: "en" })}>
                        <Tag
                            color={
                                property.legal_info.has_restrictions
                                    ? "red"
                                    : "green"
                            }
                        >
                            {property.legal_info.has_restrictions
                                ? "Yes"
                                : "No"}
                        </Tag>
                    </Descriptions.Item>
                )}
                {property.legal_info?.vat_paid !== undefined && (
                    <Descriptions.Item label={td("VAT Paid", { source: "en" })}>
                        <Tag
                            color={
                                property.legal_info.vat_paid
                                    ? "green"
                                    : "orange"
                            }
                        >
                            {property.legal_info.vat_paid ? "Yes" : "No"}
                        </Tag>
                    </Descriptions.Item>
                )}
                {property.legal_info?.trafo_paid !== undefined && (
                    <Descriptions.Item label={td("Trafo Paid", { source: "en" })}>
                        <Tag
                            color={
                                property.legal_info.trafo_paid
                                    ? "green"
                                    : "orange"
                            }
                        >
                            {property.legal_info.trafo_paid ? "Yes" : "No"}
                        </Tag>
                    </Descriptions.Item>
                )}
                {property.legal_info?.stopaj_paid !== undefined && (
                    <Descriptions.Item label={td("Stopaj Paid", { source: "en" })}>
                        <Tag
                            color={
                                property.legal_info.stopaj_paid
                                    ? "green"
                                    : "orange"
                            }
                        >
                            {property.legal_info.stopaj_paid ? "Yes" : "No"}
                        </Tag>
                    </Descriptions.Item>
                )}
                {property.minimal_rental_period && (
                    <Descriptions.Item label={td("Minimum Rental Period", { source: "en" })}>
                        {property.minimal_rental_period}
                    </Descriptions.Item>
                )}
                {property.rent_payment_interval && (
                    <Descriptions.Item label={td("Payment Interval", { source: "en" })}>
                        {property.rent_payment_interval}
                    </Descriptions.Item>
                )}
                {property.legal_info?.development_rate !== undefined && (
                    <Descriptions.Item label={td("Development Rate", { source: "en" })}>
                        {property.legal_info.development_rate}%
                    </Descriptions.Item>
                )}
                {property.legal_info?.max_floor_permission !== undefined && (
                    <Descriptions.Item label={td("Max Floor Permission", { source: "en" })}>
                        {property.legal_info.max_floor_permission}
                    </Descriptions.Item>
                )}
            </Descriptions>

            {/* Payment Plan — land */}
            {property.legal_info?.has_payment_plan && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <Typography.Text
                        type="secondary"
                        className="text-xs block mb-2"
                    >
                        {td("Payment Plan", { source: "en" })}
                    </Typography.Text>
                    <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                        {property.legal_info.downpayment_value !==
                            undefined && (
                            <Descriptions.Item label={td("Down Payment", { source: "en" })}>
                                {property.legal_info.downpayment_value}
                                {property.legal_info.downpayment_is_percentage
                                    ? "%"
                                    : ""}
                            </Descriptions.Item>
                        )}
                        {property.legal_info.payment_period_months !==
                            undefined && (
                            <Descriptions.Item label={td("Payment Period", { source: "en" })}>
                                {property.legal_info.payment_period_months}{" "}
                                months
                            </Descriptions.Item>
                        )}
                        {property.legal_info.interest_rate !== undefined && (
                            <Descriptions.Item label={td("Interest Rate", { source: "en" })}>
                                {property.legal_info.interest_rate}%
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                    {property.legal_info.payment_plan_notes && (
                        <Typography.Paragraph className="text-sm text-gray-600 mt-2 mb-0">
                            {property.legal_info.payment_plan_notes}
                        </Typography.Paragraph>
                    )}
                </div>
            )}
        </Card>
    );
}
