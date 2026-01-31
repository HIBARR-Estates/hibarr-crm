import { useState, useCallback, useEffect } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Tag,
    Space,
    Dropdown,
    Popconfirm,
    Avatar,
    Typography,
    Card,
    Descriptions,
    Empty,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    MoreOutlined,
    ArrowLeftOutlined,
    SettingOutlined,
    BankOutlined,
    EnvironmentOutlined,
} from "@ant-design/icons";
import type {
    Developer,
    DeveloperProject,
    ProjectLocation,
} from "../../Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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
    filters: {
        search?: string;
    };
}

// ============================================
// Components
// ============================================

interface DeveloperEditModalProps {
    open: boolean;
    onClose: () => void;
    developer: Developer;
    onSuccess: () => void;
}

const DeveloperEditModal: React.FC<DeveloperEditModalProps> = ({
    open,
    onClose,
    developer,
    onSuccess,
}) => {
    const [form] = Form.useForm();

    const updateMutation = useApiMutate<
        { name: string; logo_url?: string; description?: string },
        Developer,
        ApiSuccessResponse<Developer>
    >(route("developers.update", developer.id), "PUT", () => {
        onClose();
        onSuccess();
    });

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            updateMutation.mutate(values);
        });
    };

    useEffect(() => {
        if (open) {
            form.setFieldsValue({
                name: developer.name,
                logo_url: developer.logo_url,
                description: developer.description,
            });
        }
    }, [open, developer, form]);

    return (
        <Modal
            title="Edit Developer"
            open={open}
            onCancel={() => !updateMutation.isPending && onClose()}
            footer={[
                <Button
                    key="cancel"
                    onClick={onClose}
                    disabled={updateMutation.isPending}
                >
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    onClick={handleSubmit}
                    loading={updateMutation.isPending}
                >
                    Update
                </Button>,
            ]}
            destroyOnClose
        >
            <Form form={form} layout="vertical" className="mt-4">
                <Form.Item
                    name="name"
                    label="Developer Name"
                    rules={[
                        {
                            required: true,
                            message: "Please enter the developer name",
                        },
                    ]}
                >
                    <Input placeholder="Enter developer name" />
                </Form.Item>

                <Form.Item
                    name="logo_url"
                    label="Logo URL"
                    rules={[
                        { type: "url", message: "Please enter a valid URL" },
                    ]}
                >
                    <Input placeholder="https://example.com/logo.png" />
                </Form.Item>

                <Form.Item name="description" label="Description">
                    <TextArea
                        placeholder="Enter developer description"
                        rows={4}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

// ============================================
// Main Component
// ============================================

const Show = ({ pageTitle, developer, projects, filters }: ShowProps) => {
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [searchValue, setSearchValue] = useState(filters.search || "");

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
                        Edit Developer
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
                            <div className="flex gap-4">
                                <Tag color="blue">
                                    {developer.projects_count || 0} Projects
                                </Tag>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Projects Table */}
                <Card
                    title="Developer Projects"
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
                                    Go to Developer Projects
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
            </div>

            {/* Edit Modal */}
            <DeveloperEditModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                developer={developer}
                onSuccess={handleSuccess}
            />
        </PageLayout>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
