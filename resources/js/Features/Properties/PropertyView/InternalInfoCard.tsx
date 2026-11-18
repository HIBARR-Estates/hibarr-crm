import React from "react";
import { Card, Descriptions, Tag, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { Property } from "@/Types";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Text, Paragraph } = Typography;

interface InternalInfoCardProps {
    property: Property;
}

export default function InternalInfoCard({ property }: InternalInfoCardProps) {
    const { td } = useTd();
    const fi = property.financial_info;

    // Internal info is stored across financial_info and top-level fields
    const hasPriceToOwner =
        fi?.owner_price !== undefined && fi?.owner_price !== null;
    const hasHibarrPrice =
        fi?.hibarr_price !== undefined && fi?.hibarr_price !== null;
    const hasCommission = fi?.commission_signed !== undefined;
    const hasDues = !!(property as any).dues;
    const hasNotes = !!(property as any).general_notes;

    const hasAny =
        hasPriceToOwner ||
        hasHibarrPrice ||
        hasCommission ||
        hasDues ||
        hasNotes;

    if (!hasAny) return null;

    return (
        <Card
            title={
                <span>
                    <LockOutlined className="mr-2" />
                    Internal Info
                </span>
            }
            variant="outlined"
            size="small"
        >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                {hasPriceToOwner && (
                    <Descriptions.Item label={td("Price to Owner", { source: "en" })}>
                        {fi!.owner_price_currency || ""}{" "}
                        {fi!.owner_price?.toLocaleString()}
                    </Descriptions.Item>
                )}
                {hasHibarrPrice && (
                    <Descriptions.Item label={td("HIBARR Price", { source: "en" })}>
                        {fi!.hibarr_price_currency || ""}{" "}
                        {fi!.hibarr_price?.toLocaleString()}
                    </Descriptions.Item>
                )}
                {hasDues && (
                    <Descriptions.Item label={td("Monthly Dues", { source: "en" })}>
                        {(property as any).dues}
                    </Descriptions.Item>
                )}
                {hasCommission && (
                    <Descriptions.Item label={td("Commission Signed", { source: "en" })}>
                        <Tag color={fi!.commission_signed ? "green" : "orange"}>
                            {fi!.commission_signed ? "Yes" : "No"}
                        </Tag>
                    </Descriptions.Item>
                )}
            </Descriptions>

            {hasNotes && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                    <Text type="secondary" className="text-xs block mb-1">
                        {td("General Notes", { source: "en" })}
                    </Text>
                    <Paragraph className="text-sm text-gray-700 mb-0">
                        {(property as any).general_notes}
                    </Paragraph>
                </div>
            )}
        </Card>
    );
}
