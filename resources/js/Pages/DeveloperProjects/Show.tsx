import { useState } from "react";
import { Link, router } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import {
    Button,
    Card,
    Descriptions,
    Tag,
    Table,
    Space,
    Empty,
    Popconfirm,
} from "antd";
import type { TableColumnsType } from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import {
    EditOutlined,
    SettingOutlined,
    ArrowLeftOutlined,
    PlusOutlined,
    DeleteOutlined,
    EnvironmentOutlined,
} from "@ant-design/icons";
import type {
    DeveloperProject,
    ProjectLocation,
    DeveloperProjectExposeConfig,
} from "../../Types/developerProject";
import type { Property } from "../../Types";
import { useApiMutate } from "../../lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "../../lib/api/types";

// ============================================
// Types
// ============================================

export interface ShowProps extends PageProps {
    pageTitle: string;
    project: DeveloperProject & {
        location?: ProjectLocation;
        expose_config?: DeveloperProjectExposeConfig;
        properties?: Property[];
    };
}

// ============================================
// Main Component
// ============================================

const Show = ({ pageTitle, project }: ShowProps) => {
    const [propertyToRemove, setPropertyToRemove] = useState<number | null>(
        null,
    );

    // Mutation for removing properties from project
    const removePropertyMutation = useApiMutate<
        { property_ids: number[] },
        null,
        ApiSuccessResponse<null>
    >(route("developer-projects.remove-properties", project.id), "POST", () => {
        setPropertyToRemove(null);
        router.reload({ only: ["project"] });
    });

    const handleRemoveProperty = (propertyId: number) => {
        setPropertyToRemove(propertyId);
        removePropertyMutation.mutate({ property_ids: [propertyId] });
    };

    // Property table columns
    const propertyColumns: TableColumnsType<Property> = [
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            render: (title: string, record) => (
                <Link
                    href={route("properties.show", record.id)}
                    className="text-blue-600 hover:text-blue-800"
                >
                    {title || `Property #${record.id}`}
                </Link>
            ),
        },
        {
            title: "Type",
            dataIndex: "property_type",
            key: "property_type",
            render: (type: string) => <Tag>{type}</Tag>,
        },
        {
            title: "City",
            dataIndex: "city",
            key: "city",
        },
        {
            title: "Price",
            dataIndex: "price",
            key: "price",
            render: (price: number) =>
                price
                    ? new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "GBP",
                      }).format(price)
                    : "-",
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (status: string) => {
                const colors: Record<string, string> = {
                    Available: "green",
                    "Under offer": "orange",
                    Sold: "red",
                    Withdrawn: "default",
                };
                return <Tag color={colors[status] || "default"}>{status}</Tag>;
            },
        },
        {
            title: "Actions",
            key: "actions",
            width: 100,
            render: (_, record) => (
                <Popconfirm
                    title="Remove from project?"
                    description="The property will be unassigned from this project."
                    onConfirm={() => handleRemoveProperty(record.id)}
                    okText="Remove"
                    cancelText="Cancel"
                >
                    <Button
                        type="text"
                        danger
                        size="small"
                        loading={
                            propertyToRemove === record.id &&
                            removePropertyMutation.isPending
                        }
                        icon={<DeleteOutlined />}
                    >
                        Remove
                    </Button>
                </Popconfirm>
            ),
        },
    ];

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                {
                    name: "Developer Projects",
                    url: route("developer-projects.index"),
                },
                { name: project.name },
            ]}
        >
            <div className="max-w-6xl mx-auto flex flex-col gap-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link href={route("developer-projects.index")}>
                        <Button icon={<ArrowLeftOutlined />}>
                            Back to Projects
                        </Button>
                    </Link>
                    <Space>
                        <Link
                            href={route(
                                "developer-projects.expose-config.show",
                                project.id,
                            )}
                        >
                            <Button icon={<SettingOutlined />}>
                                Configure Expose
                            </Button>
                        </Link>
                    </Space>
                </div>

                {/* Project Details */}
                <Card title="Project Details">
                    <Descriptions column={2}>
                        <Descriptions.Item label="Name">
                            {project.name}
                        </Descriptions.Item>
                        <Descriptions.Item label="Created">
                            {new Date(project.created_at).toLocaleDateString()}
                        </Descriptions.Item>
                        <Descriptions.Item label="Description" span={2}>
                            {project.description || (
                                <span className="text-gray-400">
                                    No description
                                </span>
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Location">
                            {project.location ? (
                                <Space>
                                    <EnvironmentOutlined className="text-blue-500" />
                                    <span>{project.location.name}</span>
                                    {project.location.address?.city && (
                                        <Tag>
                                            {project.location.address.city}
                                        </Tag>
                                    )}
                                </Space>
                            ) : (
                                <span className="text-gray-400">
                                    Not assigned
                                </span>
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Expose Config">
                            {project.expose_config ? (
                                <Tag color="green">Configured</Tag>
                            ) : (
                                <Tag color="orange">Not configured</Tag>
                            )}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* Location Details */}
                {project.location && (
                    <Card title="Location Details">
                        <Descriptions column={2}>
                            <Descriptions.Item label="Name">
                                {project.location.name}
                            </Descriptions.Item>
                            <Descriptions.Item label="Full Address">
                                {[
                                    project.location.address?.street,
                                    project.location.address?.city,
                                    project.location.address?.state,
                                    project.location.address?.country,
                                ]
                                    .filter(Boolean)
                                    .join(", ") || "-"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Attractions">
                                {project.location.attractions?.length || 0}{" "}
                                configured
                            </Descriptions.Item>
                            <Descriptions.Item label="Infrastructure">
                                {project.location.infrastructure?.length || 0}{" "}
                                items
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>
                )}

                {/* Properties */}
                <Card
                    title={`Properties (${project.properties?.length || 0})`}
                    extra={
                        <Link href={route("properties.index")}>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                size="small"
                            >
                                Assign Properties
                            </Button>
                        </Link>
                    }
                >
                    {project.properties && project.properties.length > 0 ? (
                        <Table
                            columns={propertyColumns}
                            dataSource={project.properties}
                            rowKey="id"
                            pagination={{
                                pageSize: 10,
                                showSizeChanger: false,
                            }}
                            size="small"
                        />
                    ) : (
                        <Empty
                            description="No properties assigned to this project"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        >
                            <Link href={route("properties.index")}>
                                <Button type="primary">Go to Properties</Button>
                            </Link>
                        </Empty>
                    )}
                </Card>
            </div>
        </PageLayout>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
