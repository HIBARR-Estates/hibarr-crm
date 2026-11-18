import { useState, useCallback } from "react";
import { Link, router } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
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
    Alert,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import type { LaravelPaginationMeta } from "@/Components/DataTable";
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
    FolderOpenOutlined,
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
import { formatLocationNameForDisplay } from "@/lib/utils";
import HiddenBadge from "../DeveloperProjects/components/HiddenBadge";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    visibility?: {
        enabled?: boolean;
        canSeeHidden?: boolean;
        canToggleHidden?: boolean;
        canSeeHiddenProjects?: boolean;
        canToggleProjectHidden?: boolean;
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
    visibility,
}: ShowProps) => {
    const { td } = useTd();
    const { t } = useTranslation();
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editProject, setEditProject] = useState<DeveloperProject | null>(
        null,
    );
    const [searchValue, setSearchValue] = useState(filters.search || "");
    const [offerModalOpen, setOfferModalOpen] = useState(false);
    const [editOffer, setEditOffer] = useState<Offer | null>(null);
    const [drawerOfferId, setDrawerOfferId] = useState<number | null>(null);

    const showHiddenBadge =
        visibility?.enabled === true && visibility?.canSeeHidden === true;
    const canToggleHidden =
        visibility?.enabled === true && visibility?.canToggleHidden === true;
    const canToggleProjectHidden =
        visibility?.enabled === true &&
        visibility?.canToggleProjectHidden === true;
    const showProjectHiddenBadge =
        visibility?.enabled === true &&
        visibility?.canSeeHiddenProjects === true;

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
            title: td("Project Name", { source: "en" }),
            dataIndex: "name",
            key: "name",
            render: (name: string, record) => (
                <Link
                    href={route("developer-projects.show", record.id)}
                    className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-2"
                >
                    {name}
                    {showProjectHiddenBadge &&
                        (record.is_hidden || developer.is_hidden) && (
                            <HiddenBadge
                                inherited={
                                    !!developer.is_hidden && !record.is_hidden
                                }
                            />
                        )}
                </Link>
            ),
        },
        {
            title: td("Location", { source: "en" }),
            dataIndex: "location",
            key: "location",
            render: (location: ProjectLocation | undefined) =>
                location ? (
                    <Space>
                        <EnvironmentOutlined className="text-gray-400" />
                        <span>{formatLocationNameForDisplay(location.name)}</span>
                    </Space>
                ) : (
                    <Text type="secondary">{td("No location", { source: "en" })}</Text>
                ),
        },
        {
            title: td("Properties", { source: "en" }),
            dataIndex: "properties_count",
            key: "properties_count",
            align: "center",
            render: (count: number) => <Tag color="blue">{count || 0}</Tag>,
        },
        {
            title: td("Links", { source: "en" }),
            key: "links",
            render: (_, record) => (
                <Space size="small" wrap>
                    {record.google_drive_link && (
                        <a
                            href={record.google_drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Tag
                                color="blue"
                                icon={<SettingOutlined />}
                                className="cursor-pointer"
                            >
                                {td("Drive", { source: "en" })}
                            </Tag>
                        </a>
                    )}
                    {record.availability_link && (
                        <a
                            href={record.availability_link}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Tag color="purple" className="cursor-pointer">
                                {td("Availability", { source: "en" })}
                            </Tag>
                        </a>
                    )}
                    {!record.google_drive_link && !record.availability_link && (
                        <Text type="secondary">—</Text>
                    )}
                </Space>
            ),
        },
        {
            title: td("Expose", { source: "en" }),
            dataIndex: "expose_config",
            key: "expose_config",
            align: "center",
            render: (config: any, record) =>
                config ? (
                    <Tag color="green">{td("Configured", { source: "en" })}</Tag>
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
                            {td("Setup", { source: "en" })}
                        </Button>
                    </Link>
                ),
        },
        {
            title: td("Actions", { source: "en" }),
            key: "actions",
            align: "center",
            width: 80,
            render: (_, record) => {
                const menuItems: MenuProps["items"] = [
                    {
                        key: "edit",
                        icon: <EditOutlined />,
                        label: td("Edit Project", { source: "en" }),
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
                                {td("View", { source: "en" })}
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
                                {td("Expose Config", { source: "en" })}
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
                { name: t("app.developers.title"), url: route("developers.index") },
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
                        {td("Edit Company", { source: "en" })}
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
                                {showHiddenBadge && developer.is_hidden && (
                                    <span className="ml-3 align-middle">
                                        <HiddenBadge />
                                    </span>
                                )}
                            </Title>
                            {showHiddenBadge && developer.is_hidden && (
                                <Alert
                                    type="info"
                                    showIcon
                                    className="mb-4"
                                    message={td("This developer is hidden from view-only users. All of its projects are also hidden for those users, even if a project’s own Hidden flag is off.", { source: "en" })}
                                />
                            )}
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
                                            <WhatsAppOutlined /> {td("WhatsApp Group", { source: "en" })}
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
                                                    td("Link copied to clipboard", { source: "en" }),
                                                );
                                            }}
                                        />
                                    </Space>
                                )}
                                {developer.google_drive_link && (
                                    <Space size="small">
                                        <a
                                            href={developer.google_drive_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        >
                                            <FolderOpenOutlined /> {td("Google Drive", { source: "en" })}
                                        </a>
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CopyOutlined />}
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    developer.google_drive_link!,
                                                );
                                                message.success(
                                                    td("Link copied to clipboard", { source: "en" }),
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
                    title={td("Projects", { source: "en" })}
                    extra={
                        <Input.Search
                            placeholder={td("Search projects...", { source: "en" })}
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
                            description={td("No projects found for this developer", { source: "en" })}
                        >
                            <Link href={route("developer-projects.index")}>
                                <Button type="primary">{td("Go to Projects", { source: "en" })}</Button>
                            </Link>
                        </Empty>
                    ) : (
                        <DataTable<DeveloperProject>
                            columns={columns}
                            dataSource={projects.data}
                            rowKey="id"
                            paginationData={{
                                current_page: projects.current_page,
                                last_page: projects.last_page,
                                per_page: projects.per_page,
                                total: projects.total,
                                from: projects.from,
                                to: projects.to,
                            }}
                            onPageChange={(page) => {
                                router.get(
                                    route("developers.show", developer.id),
                                    { ...filters, page },
                                    { preserveState: true },
                                );
                            }}
                            scroll={{ x: 1000, y: "calc(100vh - 280px)" }}
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
                            {td("New Offer", { source: "en" })}
                        </Button>
                    }
                >
                    {offers.length === 0 ? (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={td("No offers for this developer", { source: "en" })}
                        >
                            <Button
                                type="primary"
                                onClick={() => {
                                    setEditOffer(null);
                                    setOfferModalOpen(true);
                                }}
                            >
                                {td("Create First Offer", { source: "en" })}
                            </Button>
                        </Empty>
                    ) : (
                        <DataTable<Offer>
                            dataSource={offers}
                            rowKey="id"
                            size="small"
                            columns={[
                                {
                                    title: td("Name", { source: "en" }),
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
                                    title: td("Type", { source: "en" }),
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
                                    title: td("Value", { source: "en" }),
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
                                    title: td("Status", { source: "en" }),
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
                                    title: td("Projects", { source: "en" }),
                                    dataIndex: "developer_projects_count",
                                    key: "projects",
                                    width: 80,
                                    align: "center" as const,
                                    render: (v: number) => v ?? 0,
                                },
                                {
                                    title: td("Actions", { source: "en" }),
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
                canToggleHidden={canToggleHidden}
            />

            {/* Edit Construction Project Modal */}
            <ConstructionProjectFormModal
                open={!!editProject}
                onClose={() => setEditProject(null)}
                project={editProject}
                canToggleHidden={canToggleProjectHidden}
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
