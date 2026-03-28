import { useState, useCallback } from "react";
import { Link, router } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import {
    Table,
    Button,
    Input,
    Tag,
    Space,
    Dropdown,
    Avatar,
    Typography,
    Card,
    Empty,
    message,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import {
    EditOutlined,
    EyeOutlined,
    MoreOutlined,
    SettingOutlined,
    BankOutlined,
    EnvironmentOutlined,
    WhatsAppOutlined,
    CopyOutlined,
    GiftOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import type {
    Developer,
    DeveloperProject,
    ProjectLocation,
} from "../../Types/developerProject";
import type { Offer } from "@/Types/api/offers";
import DeveloperFormModal from "@/Features/Developers/DeveloperFormModal";
import ConstructionProjectFormModal from "@/Features/DeveloperProjects/ConstructionProjectFormModal";
import OfferFormModal from "@/Features/Offers/OfferFormModal";
import OfferDetailDrawer from "@/Features/Offers/OfferDetailDrawer";

const { Title, Text, Paragraph } = Typography;

// ============================================
// Types
// ============================================

interface PaginationData {
    data: DeveloperProject[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export interface ShowProps extends PageProps {
    pageTitle: string;
    developer: Developer;
    projects: PaginationData;
    offers: Offer[];
    filters: {
        search?: string;
    };
}

// ============================================
// Main Component
// ============================================

const Show = ({
    pageTitle,
    developer,
    projects,
    offers,
    filters,
}: ShowProps) => {
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editProject, setEditProject] = useState<DeveloperProject | null>(
        null,
    );
    const [searchValue, setSearchValue] = useState(filters.search || "");
    const [offerModalOpen, setOfferModalOpen] = useState(false);
    const [editOffer, setEditOffer] = useState<Offer | null>(null);
    const [drawerOfferId, setDrawerOfferId] = useState<number | null>(null);

    const handleSuccess = useCallback(() => {
        router.reload({ only: ["developer", "projects"] });
    }, []);

    const handleSearch = useCallback(
        (value: string) => {
            router.get(
                route("developers.show", developer.id),
                { search: value || undefined },
                { preserveState: true, preserveScroll: true },
            );
        },
        [developer.id],
    );

    // Table columns for projects
    const columns: TableColumnsType<DeveloperProject> = [
        {
            title: "Project Name",
            dataIndex: "name",
            key: "name",
            render: (name: string, record) => (
                <Link
                    href={route("developer-projects.show", record.id)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                >
                    {name}
                </Link>
            ),
        },
        {
            title: "Location",
            dataIndex: "location",
            key: "location",
            render: (location: ProjectLocation | undefined) =>
                location ? (
                    <Space>
                        <EnvironmentOutlined className="text-gray-400" />
                        <span>{location.name}</span>
                    </Space>
                ) : (
                    <Text type="secondary">No location</Text>
                ),
        },
        {
            title: "Properties",
            dataIndex: "properties_count",
            key: "properties_count",
            align: "center",
            render: (count: number) => <Tag color="blue">{count || 0}</Tag>,
        },
        {
            title: "Expose",
            dataIndex: "expose_config",
            key: "expose_config",
            align: "center",
            render: (config: any, record) =>
                config ? (
                    <Tag color="green">Configured</Tag>
                ) : (
                    <Link
                        href={route(
                            "developer-projects.expose-config.show",
                            record.id,
                        )}
                    >
                        <Button
                            type="link"
                            size="small"
                            icon={<SettingOutlined />}
                        >
                            Setup
                        </Button>
                    </Link>
                ),
        },
        {
            title: "Actions",
            key: "actions",
            align: "center",
            width: 80,
            render: (_, record) => {
                const menuItems: MenuProps["items"] = [
                    {
                        key: "edit",
                        icon: <EditOutlined />,
                        label: "Edit Project",
                        onClick: () => setEditProject(record),
                    },
                    {
                        key: "view",
                        icon: <EyeOutlined />,
                        label: (
                            <Link
                                href={route(
                                    "developer-projects.show",
                                    record.id,
                                )}
                            >
                                View
                            </Link>
                        ),
                    },
                    {
                        key: "expose",
                        icon: <SettingOutlined />,
                        label: (
                            <Link
                                href={route(
                                    "developer-projects.expose-config.show",
                                    record.id,
                                )}
                            >
                                Expose Config
                            </Link>
                        ),
                    },
                ];

                return (
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                        <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: "Developers", url: route("developers.index") },
                { name: developer.name },
            ]}
        >
            <div className="max-w-7xl mx-auto flex flex-col gap-y-6">
                {/* Back Link */}
                <div>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => setEditModalOpen(true)}
                    >
                        Edit Company
                    </Button>
                </div>

                {/* Developer Info Card */}
                <Card>
                    <div className="flex items-start gap-6">
                        <Avatar
                            size={100}
                            src={developer.logo_url}
                            icon={!developer.logo_url && <BankOutlined />}
                        />
                        <div className="flex-1">
                            <Title level={3} className="mb-2">
                                {developer.name}
                            </Title>
                            {developer.description && (
                                <Paragraph className="text-gray-600 mb-4">
                                    {developer.description}
                                </Paragraph>
                            )}
                            <div className="flex flex-wrap gap-4 items-center">
                                <Tag color="blue">
                                    {developer.projects_count || 0} Projects
                                </Tag>
                                {developer.whatsapp_group_link && (
                                    <Space size="small">
                                        <a
                                            href={developer.whatsapp_group_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-green-600 hover:text-green-800 flex items-center gap-1"
                                        >
                                            <WhatsAppOutlined /> WhatsApp Group
                                        </a>
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CopyOutlined />}
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    developer.whatsapp_group_link!,
                                                );
                                                message.success(
                                                    "Link copied to clipboard",
                                                );
                                            }}
                                        />
                                    </Space>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Projects Table */}
                <Card
                    title="Construction Projects"
                    extra={
                        <Input.Search
                            placeholder="Search projects..."
                            allowClear
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onSearch={handleSearch}
                            style={{ width: 250 }}
                        />
                    }
                >
                    {projects.data.length === 0 ? (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="No projects found for this developer"
                        >
                            <Link href={route("developer-projects.index")}>
                                <Button type="primary">
                                    Go to Construction Projects
                                </Button>
                            </Link>
                        </Empty>
                    ) : (
                        <Table
                            columns={columns}
                            dataSource={projects.data}
                            rowKey="id"
                            pagination={{
                                current: projects.current_page,
                                pageSize: projects.per_page,
                                total: projects.total,
                                showSizeChanger: false,
                                onChange: (page) => {
                                    router.get(
                                        route("developers.show", developer.id),
                                        { ...filters, page },
                                        { preserveState: true },
                                    );
                                },
                            }}
                        />
                    )}
                </Card>

                {/* Offers Section */}
                <Card
                    title={
                        <Space>
                            <GiftOutlined />
                            Offers ({offers.length})
                        </Space>
                    }
                    extra={
                        <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                setEditOffer(null);
                                setOfferModalOpen(true);
                            }}
                        >
                            New Offer
                        </Button>
                    }
                >
                    {offers.length === 0 ? (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="No offers for this developer"
                        >
                            <Button
                                type="primary"
                                onClick={() => {
                                    setEditOffer(null);
                                    setOfferModalOpen(true);
                                }}
                            >
                                Create First Offer
                            </Button>
                        </Empty>
                    ) : (
                        <Table
                            dataSource={offers}
                            rowKey="id"
                            pagination={false}
                            size="small"
                            columns={[
                                {
                                    title: "Name",
                                    dataIndex: "name",
                                    key: "name",
                                    render: (name: string, record: Offer) => (
                                        <a
                                            onClick={() =>
                                                setDrawerOfferId(record.id)
                                            }
                                        >
                                            {name}
                                        </a>
                                    ),
                                },
                                {
                                    title: "Type",
                                    dataIndex: "type",
                                    key: "type",
                                    width: 100,
                                    render: (type: string) => (
                                        <Tag
                                            color={
                                                type === "percentage"
                                                    ? "blue"
                                                    : "green"
                                            }
                                        >
                                            {type === "percentage"
                                                ? "Percentage"
                                                : "Fixed"}
                                        </Tag>
                                    ),
                                },
                                {
                                    title: "Value",
                                    key: "value",
                                    width: 100,
                                    render: (_: any, record: Offer) =>
                                        record.type === "percentage"
                                            ? `${record.value}%`
                                            : Number(
                                                  record.value,
                                              ).toLocaleString("en-GB"),
                                },
                                {
                                    title: "Status",
                                    dataIndex: "is_active",
                                    key: "status",
                                    width: 90,
                                    render: (active: boolean) => (
                                        <Tag
                                            color={active ? "green" : "default"}
                                        >
                                            {active ? "Active" : "Inactive"}
                                        </Tag>
                                    ),
                                },
                                {
                                    title: "Projects",
                                    dataIndex: "developer_projects_count",
                                    key: "projects",
                                    width: 80,
                                    align: "center" as const,
                                    render: (v: number) => v ?? 0,
                                },
                                {
                                    title: "Actions",
                                    key: "actions",
                                    width: 80,
                                    align: "center" as const,
                                    render: (_: any, record: Offer) => (
                                        <Space size="small">
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<EyeOutlined />}
                                                onClick={() =>
                                                    setDrawerOfferId(record.id)
                                                }
                                            />
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<EditOutlined />}
                                                onClick={() => {
                                                    setEditOffer(record);
                                                    setOfferModalOpen(true);
                                                }}
                                            />
                                        </Space>
                                    ),
                                },
                            ]}
                        />
                    )}
                </Card>
            </div>

            {/* Edit Developer Modal */}
            <DeveloperFormModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                developer={developer}
                onSuccess={handleSuccess}
            />

            {/* Edit Construction Project Modal */}
            <ConstructionProjectFormModal
                open={!!editProject}
                onClose={() => setEditProject(null)}
                project={editProject}
                developer={developer}
                onSuccess={handleSuccess}
            />

            {/* Offer Form Modal */}
            <OfferFormModal
                open={offerModalOpen}
                onClose={() => {
                    setOfferModalOpen(false);
                    setEditOffer(null);
                }}
                offer={editOffer}
                defaultDeveloperId={developer.id}
                onSuccess={handleSuccess}
            />

            {/* Offer Detail Drawer */}
            <OfferDetailDrawer
                open={!!drawerOfferId}
                onClose={() => setDrawerOfferId(null)}
                offerId={drawerOfferId}
                onEdit={(offer) => {
                    setDrawerOfferId(null);
                    setEditOffer(offer);
                    setOfferModalOpen(true);
                }}
            />
        </PageLayout>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
