import React from "react";
import { Link } from "@inertiajs/react";
import { Card, Image, Avatar, Tag, Empty, Typography } from "antd";
import { BankOutlined, WhatsAppOutlined } from "@ant-design/icons";
import type { Developer, DeveloperProject } from "../../../Types/developerProject";
import ProjectCard from "./ProjectCard";

const { Title, Paragraph, Text } = Typography;

const DevelopersSection: React.FC<{
    developer: Developer | null | undefined;
    developerProjects?: DeveloperProject[];
}> = ({ developer, developerProjects = [] }) => {
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

            </Card>

            {developerProjects.length > 0 && (
                <div>
                    <Text strong className="block mb-3 text-sm text-gray-500">
                        Other projects by {developer.name}:
                    </Text>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {developerProjects.map((p) => (
                            <ProjectCard key={p.id} project={p} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevelopersSection;
