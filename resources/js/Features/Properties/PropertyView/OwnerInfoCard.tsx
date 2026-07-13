import React from "react";
import {
    Card,
    Descriptions,
    Alert,
    Tag,
    Space,
    Typography,
} from "antd";
import {
    UserOutlined,
    PhoneOutlined,
    MailOutlined,
    LockOutlined,
    TeamOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";

const { Text } = Typography;

interface OwnerInfoCardProps {
    property: Property;
    canViewOwnerInfo: boolean;
    isSalesManager: boolean;
}

export default function OwnerInfoCard({
    property,
    canViewOwnerInfo,
    isSalesManager,
}: OwnerInfoCardProps) {
    const ownerInfo = property.owner_info;
    const hasOwnerInfo =
        ownerInfo &&
        (ownerInfo.full_name ||
            ownerInfo.telephone ||
            ownerInfo.email ||
            ownerInfo.key_holder_name);

    return (
        <Card
            title={
                <span>
                    <UserOutlined className="mr-2" />
                    Owner Information
                </span>
            }
            variant="outlined"
            size="small"
        >
            {canViewOwnerInfo ? (
                hasOwnerInfo ? (
                    <>
                        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                            {ownerInfo?.full_name && (
                                <Descriptions.Item label="Owner Name">
                                    <Space>
                                        <UserOutlined />
                                        {ownerInfo.full_name}
                                    </Space>
                                </Descriptions.Item>
                            )}
                            {ownerInfo?.telephone && (
                                <Descriptions.Item label="Phone">
                                    <Space>
                                        <PhoneOutlined />
                                        <a href={`tel:${ownerInfo.telephone}`}>
                                            {ownerInfo.telephone}
                                        </a>
                                    </Space>
                                </Descriptions.Item>
                            )}
                            {ownerInfo?.email && (
                                <Descriptions.Item label="Email">
                                    <Space>
                                        <MailOutlined />
                                        <a href={`mailto:${ownerInfo.email}`}>
                                            {ownerInfo.email}
                                        </a>
                                    </Space>
                                </Descriptions.Item>
                            )}
                            {ownerInfo?.key_holder_name && (
                                <Descriptions.Item label="Key Holder">
                                    <Space>
                                        <UserOutlined />
                                        {ownerInfo.key_holder_name}
                                        {ownerInfo.key_holder_phone && (
                                            <a
                                                href={`tel:${ownerInfo.key_holder_phone}`}
                                            >
                                                ({ownerInfo.key_holder_phone})
                                            </a>
                                        )}
                                    </Space>
                                </Descriptions.Item>
                            )}
                        </Descriptions>

                        {/* SM-only fields for land */}
                        {isSalesManager && (
                            <>
                                {ownerInfo?.agent_responsible && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <Descriptions column={1} size="small">
                                            <Descriptions.Item label="Agent Responsible">
                                                <Space>
                                                    <TeamOutlined />
                                                    {
                                                        ownerInfo.agent_responsible
                                                    }
                                                </Space>
                                            </Descriptions.Item>
                                        </Descriptions>
                                    </div>
                                )}
                                {(ownerInfo?.allow_101evler_publish !==
                                    undefined ||
                                    ownerInfo?.allow_hangiev_publish !==
                                        undefined) && (
                                    <div className="mt-2 flex gap-4">
                                        {ownerInfo?.allow_101evler_publish !==
                                            undefined && (
                                            <div className="flex items-center gap-2">
                                                <Text
                                                    type="secondary"
                                                    className="text-xs"
                                                >
                                                    101evler:
                                                </Text>
                                                <Tag
                                                    color={
                                                        ownerInfo.allow_101evler_publish
                                                            ? "green"
                                                            : "default"
                                                    }
                                                >
                                                    {ownerInfo.allow_101evler_publish
                                                        ? "Allowed"
                                                        : "No"}
                                                </Tag>
                                            </div>
                                        )}
                                        {ownerInfo?.allow_hangiev_publish !==
                                            undefined && (
                                            <div className="flex items-center gap-2">
                                                <Text
                                                    type="secondary"
                                                    className="text-xs"
                                                >
                                                    Hangiev:
                                                </Text>
                                                <Tag
                                                    color={
                                                        ownerInfo.allow_hangiev_publish
                                                            ? "green"
                                                            : "default"
                                                    }
                                                >
                                                    {ownerInfo.allow_hangiev_publish
                                                        ? "Allowed"
                                                        : "No"}
                                                </Tag>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <Text type="secondary">No owner information available</Text>
                )
            ) : (
                <Alert
                    type="info"
                    icon={<LockOutlined />}
                    showIcon
                    message="Owner Information Restricted"
                    description={
                        <div>
                            <p className="mb-0">
                                Owner contact details are only visible to the
                                property creator, responsible agent, and
                                administrators. To edit listing content, use
                                &quot;Request Edit Access&quot; in the property
                                header.
                            </p>
                        </div>
                    }
                />
            )}
        </Card>
    );
}
