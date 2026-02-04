import React from "react";
import {
    Card,
    Descriptions,
    Alert,
    Button,
    Divider,
    Typography,
    Space,
    Tag,
} from "antd";
import {
    UserOutlined,
    PhoneOutlined,
    MailOutlined,
    LockOutlined,
    FileTextOutlined,
    BankOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";

import { router } from "@inertiajs/react";
import usePropertyPermissions from "@/Hooks/usePropertyPermissions";

const { Text } = Typography;

interface LegalFinancialInfoProps {
    property: Property;
}

export default function LegalFinancialInfo({
    property,
}: LegalFinancialInfoProps) {
    const permissions = usePropertyPermissions(property);

    const hasLegalInfo =
        property.title_deed_type ||
        property.title_deed_stage ||
        property.minimal_rental_period ||
        property.rent_payment_interval ||
        property.legal_info;

    const hasFinancialInfo = property.financial_info;

    const hasOwnerInfo =
        property.owner_info &&
        (property.owner_info.full_name ||
            property.owner_info.telephone ||
            property.owner_info.email);

    const showOwnerSection = hasOwnerInfo || !permissions.canViewOwnerInfo;

    if (!hasLegalInfo && !hasFinancialInfo && !showOwnerSection) return null;

    const handleRequestAccess = () => {
        router.post(
            route("properties.request_access", property.id),
            {},
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <Card title="Legal, Financial & Owner Information" className="mb-6">
            {/* Legal Information */}
            {hasLegalInfo && (
                <>
                    <Typography.Title
                        level={5}
                        className="flex items-center gap-2"
                    >
                        <FileTextOutlined />
                        Legal Information
                    </Typography.Title>
                    <Descriptions
                        column={{ xs: 1, sm: 2 }}
                        size="middle"
                        className="mb-4"
                    >
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
                        {property.legal_info?.deed_status && (
                            <Descriptions.Item label="Deed Status">
                                <Tag
                                    color={
                                        property.legal_info.deed_status ===
                                        "developer_ready"
                                            ? "green"
                                            : "orange"
                                    }
                                >
                                    {property.legal_info.deed_status.replace(
                                        /_/g,
                                        " ",
                                    )}
                                </Tag>
                            </Descriptions.Item>
                        )}
                        {property.legal_info?.military_distance && (
                            <Descriptions.Item label="Military Distance">
                                {property.legal_info.military_distance}
                            </Descriptions.Item>
                        )}
                        {property.legal_info?.has_restrictions !==
                            undefined && (
                            <Descriptions.Item label="Has Restrictions">
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
                </>
            )}

            {/* Financial Information */}
            {hasFinancialInfo && (
                <>
                    <Divider />
                    <Typography.Title
                        level={5}
                        className="flex items-center gap-2"
                    >
                        <BankOutlined />
                        Financial Information
                    </Typography.Title>
                    <Descriptions
                        column={{ xs: 1, sm: 2 }}
                        size="middle"
                        className="mb-4"
                    >
                        {property.financial_info?.owner_price !== undefined && (
                            <Descriptions.Item label="Owner Price">
                                {property.financial_info.owner_price_currency ||
                                    ""}{" "}
                                {property.financial_info.owner_price?.toLocaleString()}
                            </Descriptions.Item>
                        )}
                        {property.financial_info?.hibarr_price !==
                            undefined && (
                            <Descriptions.Item label="Hibarr Price">
                                {property.financial_info
                                    .hibarr_price_currency || ""}{" "}
                                {property.financial_info.hibarr_price?.toLocaleString()}
                            </Descriptions.Item>
                        )}
                        {property.financial_info?.commission_signed !==
                            undefined && (
                            <Descriptions.Item label="Commission Signed">
                                <Tag
                                    color={
                                        property.financial_info
                                            .commission_signed
                                            ? "green"
                                            : "orange"
                                    }
                                >
                                    {property.financial_info.commission_signed
                                        ? "Yes"
                                        : "No"}
                                </Tag>
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                </>
            )}

            {/* Owner Information - Conditional Visibility */}
            {showOwnerSection && (
                <>
                    <Divider />
                    <Typography.Title
                        level={5}
                        className="flex items-center gap-2"
                    >
                        <UserOutlined />
                        Owner Information
                    </Typography.Title>

                    {permissions.canViewOwnerInfo ? (
                        hasOwnerInfo ? (
                            <Descriptions
                                column={{ xs: 1, sm: 2 }}
                                size="middle"
                            >
                                {property.owner_info?.full_name && (
                                    <Descriptions.Item label="Owner Name">
                                        <Space>
                                            <UserOutlined />
                                            {property.owner_info.full_name}
                                        </Space>
                                    </Descriptions.Item>
                                )}
                                {property.owner_info?.telephone && (
                                    <Descriptions.Item label="Phone">
                                        <Space>
                                            <PhoneOutlined />
                                            <a
                                                href={`tel:${property.owner_info.telephone}`}
                                            >
                                                {property.owner_info.telephone}
                                            </a>
                                        </Space>
                                    </Descriptions.Item>
                                )}
                                {property.owner_info?.email && (
                                    <Descriptions.Item label="Email">
                                        <Space>
                                            <MailOutlined />
                                            <a
                                                href={`mailto:${property.owner_info.email}`}
                                            >
                                                {property.owner_info.email}
                                            </a>
                                        </Space>
                                    </Descriptions.Item>
                                )}
                                {property.owner_info?.key_holder_name && (
                                    <Descriptions.Item label="Key Holder">
                                        <Space>
                                            <UserOutlined />
                                            {
                                                property.owner_info
                                                    .key_holder_name
                                            }
                                            {property.owner_info
                                                .key_holder_phone && (
                                                <a
                                                    href={`tel:${property.owner_info.key_holder_phone}`}
                                                >
                                                    (
                                                    {
                                                        property.owner_info
                                                            .key_holder_phone
                                                    }
                                                    )
                                                </a>
                                            )}
                                        </Space>
                                    </Descriptions.Item>
                                )}
                            </Descriptions>
                        ) : (
                            <Text type="secondary">
                                No owner information available
                            </Text>
                        )
                    ) : (
                        <Alert
                            type="info"
                            icon={<LockOutlined />}
                            message="Owner Information Restricted"
                            description={
                                <div>
                                    <p>
                                        Owner contact details are only visible
                                        to the property creator, responsible
                                        agent, and administrators.
                                    </p>
                                    {permissions.canRequestAccess && (
                                        <Button
                                            type="primary"
                                            size="small"
                                            className="mt-2"
                                            onClick={handleRequestAccess}
                                        >
                                            Request Access
                                        </Button>
                                    )}
                                </div>
                            }
                        />
                    )}
                </>
            )}
        </Card>
    );
}
