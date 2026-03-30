import React from "react";
import { Link } from "@inertiajs/react";
import { Card, Image, Avatar, Tag, Divider, Empty, Typography } from "antd";
import { BankOutlined, WhatsAppOutlined } from "@ant-design/icons";
import type { Developer } from "../../../Types/developerProject";

const { Title, Paragraph, Text } = Typography;

const DevelopersSection: React.FC<{ developer: Developer | null | undefined }> = ({ developer }) => {
    if (!developer) {
        return (
            <Card>
                <Empty description="No developer assigned to this project" />
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <div className="flex items-start gap-6">
                    {developer.logo_url ? (
                        <Image
                            src={developer.logo_url}
                            alt={developer.name}
                            width={96}
                            height={96}
                            className="rounded-lg object-contain"
                            preview={false}
                        />
                    ) : (
                        <Avatar
                            size={96}
                            icon={<BankOutlined />}
                            className="bg-blue-100 text-blue-600 flex-shrink-0"
                        />
                    )}
                    <div className="flex-1 min-w-0">
                        <Title level={4} className="!mb-1">
                            <Link
                                href={route("developers.show", developer.id)}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                {developer.name}
                            </Link>
                        </Title>
                        {developer.description && (
                            <Paragraph type="secondary" className="!mb-2">
                                {developer.description}
                            </Paragraph>
                        )}
                        {developer.whatsapp_group_link && (
                            <a
                                href={developer.whatsapp_group_link}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Tag
                                    color="green"
                                    icon={<WhatsAppOutlined />}
                                    className="cursor-pointer"
                                >
                                    WhatsApp Group
                                </Tag>
                            </a>
                        )}
                    </div>
                </div>

                {developer.project_list && developer.project_list.length > 0 && (
                    <>
                        <Divider />
                        <div>
                            <Text strong className="block mb-2">
                                All projects by this developer:
                            </Text>
                            <div className="flex flex-wrap gap-2">
                                {developer.project_list.map((name) => (
                                    <Tag key={name}>{name}</Tag>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
};

export default DevelopersSection;
