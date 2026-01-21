import { useState, useCallback, useMemo, useEffect } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    Tag,
    Space,
    Dropdown,
    Popconfirm,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    MoreOutlined,
    SettingOutlined,
    TeamOutlined,
} from "@ant-design/icons";
import type {
    DeveloperProject,
    ProjectLocation,
    ProjectLocationOption,
    CreateDeveloperProjectInput,
} from "../../Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { ApiSuccessResponse } from "@/lib/api/types";

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

export interface IndexProps extends PageProps {
    pageTitle: string;
    projects: PaginationData;
    filters: {
        search?: string;
        location_id?: number;
    };
}

// ============================================
// Components
// ============================================

interface ProjectFormModalProps {
    open: boolean;
    onClose: () => void;
    project?: DeveloperProject | null;
    locations: ProjectLocationOption[];
    locationsLoading: boolean;
    onSuccess: () => void;
}

const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
    open,
    onClose,
    project,
    locations,
    locationsLoading,
    onSuccess,
}) => {
    const [form] = Form.useForm();
    const isEditing = !!project;

    // Create mutation
    const createMutation = useApiMutate<
        CreateDeveloperProjectInput,
        DeveloperProject,
        ApiSuccessResponse<DeveloperProject>
    >(route("developer-projects.store"), "POST", () => {
        form.resetFields();
        onClose();
        onSuccess();
    });

    // Update mutation
    const updateMutation = useApiMutate<
        CreateDeveloperProjectInput,
        DeveloperProject,
        ApiSuccessResponse<DeveloperProject>
    >(
        project ? route("developer-projects.update", project.id) : "",
        "PUT",
        () => {
            form.resetFields();
            onClose();
            onSuccess();
        },
    );

    const isLoading = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            const payload: CreateDeveloperProjectInput = {
                name: values.name,
                description: values.description,
                project_location_id: values.project_location_id,
            };

            if (isEditing) {
                updateMutation.mutate(payload);
            } else {
                createMutation.mutate(payload);
            }
        });
    };

    // Reset form when modal opens/closes or project changes
    useEffect(() => {
        if (open) {
            form.setFieldsValue({
                name: project?.name || "",
                description: project?.description || "",
                project_location_id: project?.project_location_id || undefined,
            });
        } else {
            form.resetFields();
        }
    }, [open, project, form]);

    return (
        <Modal
            title={isEditing ? "Edit Project" : "Create Project"}
            open={open}
            onCancel={() => !isLoading && onClose()}
            footer={[
                <Button key="cancel" onClick={onClose} disabled={isLoading}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={isLoading}
                    onClick={handleSubmit}
                >
                    {isEditing ? "Update" : "Create"}
                </Button>,
            ]}
            destroyOnClose
        >
            <Form form={form} layout="vertical" className="mt-4">
                <Form.Item
                    name="name"
                    label="Project Name"
                    rules={[
                        {
                            required: true,
                            message: "Please enter project name",
                        },
                        {
                            max: 255,
                            message: "Name cannot exceed 255 characters",
                        },
                    ]}
                >
                    <Input placeholder="Enter project name" />
                </Form.Item>

                <Form.Item name="description" label="Description">
                    <Input.TextArea
                        placeholder="Enter project description (optional)"
                        rows={3}
                    />
                </Form.Item>

                <Form.Item name="project_location_id" label="Location">
                    <Select
                        placeholder="Select a location"
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        loading={locationsLoading}
                        options={locations.map((loc) => ({
                            value: loc.id,
                            label: `${loc.name}${loc.city ? ` (${loc.city})` : ""}`,
                        }))}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

// ============================================
// Main Component
// ============================================

// Response type for locations query
interface LocationsResponse {
    status: string;
    locations: ProjectLocationOption[];
}

const Index = ({ pageTitle, projects, filters }: IndexProps) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] =
        useState<DeveloperProject | null>(null);
    const [projectToDelete, setProjectToDelete] =
        useState<DeveloperProject | null>(null);

    // Query for locations - only fetches when modal is open
    const locationsQuery = useApiQuery<LocationsResponse>({
        path: route("project-locations.all"),
        options: { enabled: modalOpen },
    });

    const locations = locationsQuery.data?.locations || [];

    // Delete mutation
    const deleteMutation = useApiMutate<
        Record<string, never>,
        null,
        ApiSuccessResponse<null>
    >(
        projectToDelete
            ? route("developer-projects.destroy", projectToDelete.id)
            : "",
        "DELETE",
        () => {
            setProjectToDelete(null);
            router.reload({ only: ["projects"] });
        },
    );

    // Trigger delete when projectToDelete is set
    useEffect(() => {
        if (projectToDelete && !deleteMutation.isPending) {
            deleteMutation.mutate({});
        }
    }, [projectToDelete]);

    const handleAdd = () => {
        setSelectedProject(null);
        setModalOpen(true);
    };

    const handleEdit = (project: DeveloperProject) => {
        setSelectedProject(project);
        setModalOpen(true);
    };

    const handleDelete = useCallback((project: DeveloperProject) => {
        setProjectToDelete(project);
    }, []);

    const handleSuccess = useCallback(() => {
        router.reload({ only: ["projects"] });
    }, []);

    // Table columns
    const columns: TableColumnsType<DeveloperProject> = [
        {
            title: "Name",
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
            title: "Description",
            dataIndex: "description",
            key: "description",
            ellipsis: true,
            render: (desc: string | null) =>
                desc || <span className="text-gray-400">-</span>,
        },
        {
            title: "Location",
            dataIndex: "location",
            key: "location",
            render: (location: ProjectLocation | undefined) =>
                location ? (
                    <Tag color="blue">{location.name}</Tag>
                ) : (
                    <span className="text-gray-400">Not assigned</span>
                ),
        },
        {
            title: "Properties",
            dataIndex: "properties_count",
            key: "properties_count",
            align: "center",
            render: (count: number) => (
                <Tag color={count > 0 ? "green" : "default"}>
                    <TeamOutlined className="mr-1" />
                    {count || 0}
                </Tag>
            ),
        },
        {
            title: "Expose",
            dataIndex: "expose_config",
            key: "expose_config",
            align: "center",
            render: (config: any, record) =>
                config ? (
                    <Tag color="purple">Configured</Tag>
                ) : (
                    <Link
                        href={route(
                            "developer-projects.expose-config.show",
                            record.id,
                        )}
                        className="text-purple-600 hover:text-purple-800 text-xs"
                    >
                        Setup
                    </Link>
                ),
        },
        {
            title: "Actions",
            key: "actions",
            align: "center",
            width: 80,
            render: (_, record) => {
                const items: MenuProps["items"] = [
                    {
                        key: "view",
                        label: (
                            <Link
                                href={route(
                                    "developer-projects.show",
                                    record.id,
                                )}
                            >
                                <EyeOutlined className="mr-2" />
                                View
                            </Link>
                        ),
                    },
                    {
                        key: "edit",
                        label: (
                            <span onClick={() => handleEdit(record)}>
                                <EditOutlined className="mr-2" />
                                Edit
                            </span>
                        ),
                    },
                    {
                        key: "expose",
                        label: (
                            <Link
                                href={route(
                                    "developer-projects.expose-config.show",
                                    record.id,
                                )}
                            >
                                <SettingOutlined className="mr-2" />
                                Expose Config
                            </Link>
                        ),
                    },
                    { type: "divider" },
                    {
                        key: "delete",
                        label: (
                            <Popconfirm
                                title="Delete Project"
                                description="Are you sure? Properties will be unassigned."
                                onConfirm={() => handleDelete(record)}
                                okText="Delete"
                                cancelText="Cancel"
                                okButtonProps={{ danger: true }}
                            >
                                <span className="text-red-600">
                                    <DeleteOutlined className="mr-2" />
                                    Delete
                                </span>
                            </Popconfirm>
                        ),
                    },
                ];

                return (
                    <Dropdown menu={{ items }} trigger={["click"]}>
                        <Button type="text" icon={<MoreOutlined />} />
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[{ name: "Developer Projects" }]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                            >
                                New Project
                            </Button>
                            <Link href={route("project-locations.index")}>
                                <Button type="default">Manage Locations</Button>
                            </Link>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-lg border border-gray-200">
                        <Table
                            columns={columns}
                            dataSource={projects.data}
                            rowKey="id"
                            pagination={{
                                current: projects.current_page,
                                total: projects.total,
                                pageSize: projects.per_page,
                                showSizeChanger: false,
                                showTotal: (total, range) =>
                                    `${range[0]}-${range[1]} of ${total} projects`,
                                onChange: (page) => {
                                    router.get(
                                        route("developer-projects.index"),
                                        { ...filters, page },
                                        {
                                            preserveState: true,
                                            preserveScroll: true,
                                        },
                                    );
                                },
                            }}
                            size="middle"
                        />
                    </div>
                </div>
            </PageLayout>

            {/* Create/Edit Modal */}
            <ProjectFormModal
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setSelectedProject(null);
                }}
                project={selectedProject}
                locations={locations}
                locationsLoading={locationsQuery.isLoading}
                onSuccess={handleSuccess}
            />
        </>
    );
};

Index.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Index;
