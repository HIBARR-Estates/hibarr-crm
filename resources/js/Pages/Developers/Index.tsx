import { useState, useCallback, useEffect } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import {
    Card,
    Button,
    Modal,
    Form,
    Input,
    Empty,
    Spin,
    Row,
    Col,
    Avatar,
    Typography,
    Dropdown,
    Popconfirm,
} from "antd";
import type { MenuProps } from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    MoreOutlined,
    BankOutlined,
    ProjectOutlined,
} from "@ant-design/icons";
import type { Developer } from "../../Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// ============================================
// Types
// ============================================

interface PaginationData {
    data: Developer[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
}

export interface IndexProps extends PageProps {
    pageTitle: string;
    developers: PaginationData;
    filters: {
        search?: string;
    };
}

interface CreateDeveloperInput {
    name: string;
    logo_url?: string;
    description?: string;
}

// ============================================
// Components
// ============================================

interface DeveloperFormModalProps {
    open: boolean;
    onClose: () => void;
    developer?: Developer | null;
    onSuccess: () => void;
}

const DeveloperFormModal: React.FC<DeveloperFormModalProps> = ({
    open,
    onClose,
    developer,
    onSuccess,
}) => {
    const [form] = Form.useForm();
    const isEditing = !!developer;

    // Create mutation
    const createMutation = useApiMutate<
        CreateDeveloperInput,
        Developer,
        ApiSuccessResponse<Developer>
    >(route("developers.store"), "POST", () => {
        form.resetFields();
        onClose();
        onSuccess();
    });

    // Update mutation
    const updateMutation = useApiMutate<
        CreateDeveloperInput,
        Developer,
        ApiSuccessResponse<Developer>
    >(developer ? route("developers.update", developer.id) : "", "PUT", () => {
        form.resetFields();
        onClose();
        onSuccess();
    });

    const isLoading = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            if (isEditing && developer) {
                updateMutation.mutate(values);
            } else {
                createMutation.mutate(values);
            }
        });
    };

    // Reset form when modal opens/closes or developer changes
    useEffect(() => {
        if (open) {
            if (developer) {
                form.setFieldsValue({
                    name: developer.name,
                    logo_url: developer.logo_url,
                    description: developer.description,
                });
            } else {
                form.resetFields();
            }
        }
    }, [open, developer, form]);

    return (
        <Modal
            title={isEditing ? "Edit Developer" : "Create Developer"}
            open={open}
            onCancel={() => !isLoading && onClose()}
            footer={[
                <Button key="cancel" onClick={onClose} disabled={isLoading}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    onClick={handleSubmit}
                    loading={isLoading}
                >
                    {isEditing ? "Update" : "Create"}
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

// Developer Card Component
interface DeveloperCardProps {
    developer: Developer;
    onEdit: (developer: Developer) => void;
    onDelete: (developer: Developer) => void;
}

const DeveloperCard: React.FC<DeveloperCardProps> = ({
    developer,
    onEdit,
    onDelete,
}) => {
    const menuItems: MenuProps["items"] = [
        {
            key: "edit",
            icon: <EditOutlined />,
            label: "Edit",
            onClick: () => onEdit(developer),
        },
        {
            key: "delete",
            icon: <DeleteOutlined />,
            label: (
                <Popconfirm
                    title="Delete Developer"
                    description="Are you sure you want to delete this developer? Projects will be unassigned."
                    onConfirm={() => onDelete(developer)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                >
                    <span className="text-red-500">Delete</span>
                </Popconfirm>
            ),
            danger: true,
        },
    ];

    return (
        <Card
            hoverable
            className="h-full flex flex-col"
            actions={[
                <Dropdown
                    menu={{ items: menuItems }}
                    trigger={["click"]}
                    key="actions"
                >
                    <Button type="text" icon={<MoreOutlined />} />
                </Dropdown>,
            ]}
        >
            <Link href={route("developers.show", developer.id)}>
                <div className="flex flex-col items-center text-center">
                    <Avatar
                        size={80}
                        src={developer.logo_url}
                        icon={!developer.logo_url && <BankOutlined />}
                        className="mb-4"
                    />
                    <Title level={5} className="mb-1">
                        {developer.name}
                    </Title>
                    {developer.description && (
                        <Paragraph
                            ellipsis={{ rows: 2 }}
                            className="text-gray-500 mb-2"
                        >
                            {developer.description}
                        </Paragraph>
                    )}
                    <div className="flex items-center gap-1 text-gray-400">
                        <ProjectOutlined />
                        <Text type="secondary">
                            {developer.projects_count || 0} projects
                        </Text>
                    </div>
                </div>
            </Link>
        </Card>
    );
};

// ============================================
// Main Component
// ============================================

const Index = ({ pageTitle, developers, filters }: IndexProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDeveloper, setSelectedDeveloper] =
        useState<Developer | null>(null);
    const [developerToDelete, setDeveloperToDelete] =
        useState<Developer | null>(null);
    const [searchValue, setSearchValue] = useState(filters.search || "");

    // Delete mutation
    const deleteMutation = useApiMutate<
        Record<string, never>,
        null,
        ApiSuccessResponse<null>
    >(
        developerToDelete
            ? route("developers.destroy", developerToDelete.id)
            : "",
        "DELETE",
        () => {
            setDeveloperToDelete(null);
            router.reload({ only: ["developers"] });
        },
    );

    // Trigger delete when developerToDelete is set
    useEffect(() => {
        if (developerToDelete) {
            deleteMutation.mutate({});
        }
    }, [developerToDelete]);

    const handleAdd = () => {
        setSelectedDeveloper(null);
        setModalOpen(true);
    };

    const handleEdit = (developer: Developer) => {
        setSelectedDeveloper(developer);
        setModalOpen(true);
    };

    const handleDelete = useCallback((developer: Developer) => {
        setDeveloperToDelete(developer);
    }, []);

    const handleSuccess = useCallback(() => {
        router.reload({ only: ["developers"] });
    }, []);

    const handleSearch = useCallback((value: string) => {
        router.get(
            route("developers.index"),
            { search: value || undefined },
            { preserveState: true, preserveScroll: true },
        );
    }, []);

    return (
        <PageLayout title={pageTitle} breadcrumbs={[{ name: "Developers" }]}>
            <div className="max-w-7xl mx-auto">
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                >
                    Add Developer
                </Button>
                {/* Search */}
                <div className="mb-6 flex justify-between">
                    <Input.Search
                        placeholder="Search developers..."
                        allowClear
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onSearch={handleSearch}
                        style={{ maxWidth: 400 }}
                    />
                </div>

                {/* Developer Cards Grid */}
                {developers.data.length === 0 ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No developers found"
                    >
                        <Button type="primary" onClick={handleAdd}>
                            Create Developer
                        </Button>
                    </Empty>
                ) : (
                    <Row gutter={[24, 24]}>
                        {developers.data.map((developer) => (
                            <Col
                                key={developer.id}
                                xs={24}
                                sm={12}
                                md={8}
                                lg={6}
                            >
                                <DeveloperCard
                                    developer={developer}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                            </Col>
                        ))}
                    </Row>
                )}

                {/* Pagination */}
                {developers.last_page > 1 && (
                    <div className="mt-6 flex justify-center">
                        {/* Simple pagination - can be enhanced */}
                        <div className="flex gap-2">
                            {Array.from(
                                { length: developers.last_page },
                                (_, i) => i + 1,
                            ).map((page) => (
                                <Button
                                    key={page}
                                    type={
                                        page === developers.current_page
                                            ? "primary"
                                            : "default"
                                    }
                                    size="small"
                                    onClick={() =>
                                        router.get(
                                            route("developers.index"),
                                            { ...filters, page },
                                            { preserveState: true },
                                        )
                                    }
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Form Modal */}
            <DeveloperFormModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                developer={selectedDeveloper}
                onSuccess={handleSuccess}
            />
        </PageLayout>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
