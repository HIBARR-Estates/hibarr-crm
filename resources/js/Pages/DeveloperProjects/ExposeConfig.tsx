import { useState } from "react";
import { Link, router } from "@inertiajs/react";
import dayjs from "dayjs";
import DashboardLayout from "../../Components/DashboardLayout";
import PageLayout from "../../Components/PageLayout";
import {
    Button,
    Card,
    Tabs,
    Form,
    Input,
    message,
    Upload,
    Space,
    InputNumber,
    Divider,
    Tag,
    Alert,
    DatePicker,
    Modal,
    Descriptions,
    Spin,
    Typography,
} from "antd";
import { useApiMutate } from "../../lib/api/client/useApiMutate";
import { useApiQuery } from "../../lib/api/client/useApiQuery";
import type { ApiSuccessResponse } from "../../lib/api/types";
import type { TabsProps, UploadFile } from "antd";
import type { PageProps } from "../../Components/DashboardLayout";
import {
    SaveOutlined,
    EyeOutlined,
    PlusOutlined,
    DeleteOutlined,
    ArrowLeftOutlined,
} from "@ant-design/icons";
import type {
    DeveloperProject,
    DeveloperProjectExposeConfig,
    GroupedImageKey,
    InfoBlockKey,
} from "../../Types/developerProject";
import {
    mockUploadFile,
    type PlaceholderCategory,
} from "../../Services/MockFileService";

// ============================================
// Types
// ============================================

export interface ExposeConfigProps extends PageProps {
    pageTitle: string;
    project: DeveloperProject;
    config: DeveloperProjectExposeConfig | null;
    groupedImageKeys: GroupedImageKey[];
    infoBlockKeys: InfoBlockKey[];
}

// ============================================
// Section Components
// ============================================

interface LogoSectionProps {
    initialValues?: { dark?: string; light?: string };
    onSave: (data: any) => Promise<any>;
    saving: boolean;
}

const LogoSection: React.FC<LogoSectionProps> = ({
    initialValues,
    onSave,
    saving,
}) => {
    const [form] = Form.useForm();

    const handleMockUpload = async (file: File, field: "dark" | "light") => {
        const url = await mockUploadFile(file, "logo");
        form.setFieldValue(field, url);
        message.info("Mock upload complete - placeholder URL generated");
    };

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            onFinish={onSave}
        >
            <div className="grid grid-cols-2 gap-6">
                <Form.Item name="dark" label="Dark Logo URL">
                    <Input placeholder="URL to dark version of logo" />
                </Form.Item>
                <Form.Item name="light" label="Light Logo URL">
                    <Input placeholder="URL to light version of logo" />
                </Form.Item>
            </div>
            <div className="mb-4">
                <Alert
                    message="File Upload Note"
                    description="File storage is not yet implemented. Enter URLs directly or use mock upload for testing."
                    type="info"
                    showIcon
                />
            </div>
            <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
            >
                Save Logo Settings
            </Button>
        </Form>
    );
};

interface ProjectOverviewSectionProps {
    initialValues?: any;
    onSave: (data: any) => Promise<any>;
    saving: boolean;
}

const ProjectOverviewSection: React.FC<ProjectOverviewSectionProps> = ({
    initialValues,
    onSave,
    saving,
}) => {
    const [form] = Form.useForm();

    // Transform initial values to convert date string to dayjs object
    const getInitialValues = () => {
        if (!initialValues) return undefined;
        return {
            ...initialValues,
            completionDate: initialValues.completionDate
                ? dayjs(initialValues.completionDate)
                : undefined,
        };
    };

    // Transform form values before saving - convert dayjs to string
    const handleFinish = (values: any) => {
        const transformedValues = {
            ...values,
            completionDate: values.completionDate
                ? values.completionDate.format("YYYY-MM-DD")
                : null,
        };
        return onSave(transformedValues);
    };

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={getInitialValues()}
            onFinish={handleFinish}
        >
            <div className="grid grid-cols-2 gap-6">
                <Form.Item name="city" label="City">
                    <Input placeholder="Project city" />
                </Form.Item>
                <Form.Item name="completionDate" label="Completion Date">
                    <DatePicker
                        placeholder="Select completion date"
                        style={{ width: "100%" }}
                        format="YYYY-MM-DD"
                    />
                </Form.Item>
            </div>

            <Form.Item name="propertyOverviewImage" label="Overview Image URL">
                <Input placeholder="URL to main overview image" />
            </Form.Item>

            <Divider>Property Types</Divider>
            <Form.List name="propertyTypes">
                {(fields, { add, remove }) => (
                    <>
                        <Space wrap className="mb-2">
                            {fields.map(({ key, name }) => (
                                <Tag
                                    key={key}
                                    closable
                                    onClose={() => remove(name)}
                                >
                                    <Form.Item name={name} noStyle>
                                        <Input
                                            variant="borderless"
                                            placeholder="Type"
                                            style={{ width: 80 }}
                                        />
                                    </Form.Item>
                                </Tag>
                            ))}
                        </Space>
                        <Button
                            type="dashed"
                            onClick={() => add("")}
                            size="small"
                        >
                            <PlusOutlined /> Add Type
                        </Button>
                    </>
                )}
            </Form.List>

            <Divider>Facilities</Divider>
            <Form.List name="facilities">
                {(fields, { add, remove }) => (
                    <>
                        {fields.map(({ key, name, ...restField }) => (
                            <Card key={key} size="small" className="mb-2!">
                                <Space align="baseline">
                                    <Form.Item
                                        {...restField}
                                        name={[name, "name"]}
                                        noStyle
                                    >
                                        <Input placeholder="Facility name" />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, "image"]}
                                        noStyle
                                    >
                                        <Input
                                            placeholder="Image URL"
                                            style={{ width: 200 }}
                                        />
                                    </Form.Item>
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => remove(name)}
                                    />
                                </Space>
                            </Card>
                        ))}
                        <Button
                            type="dashed"
                            onClick={() => add({ name: "", image: "" })}
                            block
                        >
                            <PlusOutlined /> Add Facility
                        </Button>
                    </>
                )}
            </Form.List>

            <div className="mt-6">
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={saving}
                    icon={<SaveOutlined />}
                >
                    Save Overview
                </Button>
            </div>
        </Form>
    );
};

interface ImagesSectionProps {
    groupedImageKeys: GroupedImageKey[];
    initialGrouped?: Record<GroupedImageKey, string[]>;
    initialGeneric?: string[];
    onSave: (data: any) => Promise<any>;
    saving: boolean;
}

const ImagesSection: React.FC<ImagesSectionProps> = ({
    groupedImageKeys,
    initialGrouped,
    initialGeneric,
    onSave,
    saving,
}) => {
    const [form] = Form.useForm();

    // Initialize form with proper structure
    const getInitialValues = () => {
        const grouped: Record<string, string[]> = {};
        groupedImageKeys.forEach((key) => {
            grouped[key] = initialGrouped?.[key] || [];
        });
        return {
            grouped_images: grouped,
            generic_images: initialGeneric || [],
        };
    };

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={getInitialValues()}
            onFinish={onSave}
        >
            <div className="mb-4">
                <Alert
                    message="Image URLs"
                    description="Enter image URLs directly. File upload functionality will be added later."
                    type="info"
                    showIcon
                    className="mb-4"
                />
            </div>

            {groupedImageKeys.map((imageKey) => (
                <Card
                    key={imageKey}
                    title={imageKey}
                    size="small"
                    className="mb-4!"
                >
                    <Form.List name={["grouped_images", imageKey]}>
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map(({ key, name }) => (
                                    <Space
                                        key={key}
                                        className="mb-2"
                                        style={{ display: "flex" }}
                                    >
                                        <Form.Item name={name} noStyle>
                                            <Input
                                                placeholder="Image URL"
                                                style={{ width: 400 }}
                                            />
                                        </Form.Item>
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => remove(name)}
                                        />
                                    </Space>
                                ))}
                                <Button
                                    type="dashed"
                                    onClick={() => add("")}
                                    size="small"
                                >
                                    <PlusOutlined /> Add Image
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Card>
            ))}

            <Card title="Generic Images" size="small" className="mb-4">
                <Form.List name="generic_images">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name }) => (
                                <Space
                                    key={key}
                                    className="mb-2"
                                    style={{ display: "flex" }}
                                >
                                    <Form.Item name={name} noStyle>
                                        <Input
                                            placeholder="Image URL"
                                            style={{ width: 400 }}
                                        />
                                    </Form.Item>
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => remove(name)}
                                    />
                                </Space>
                            ))}
                            <Button
                                type="dashed"
                                onClick={() => add("")}
                                size="small"
                            >
                                <PlusOutlined /> Add Image
                            </Button>
                        </>
                    )}
                </Form.List>
            </Card>

            <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                icon={<SaveOutlined />}
            >
                Save Images
            </Button>
        </Form>
    );
};

interface ContactSectionProps {
    initialValues?: any;
    onSave: (data: any) => Promise<any>;
    saving: boolean;
}

const ContactSection: React.FC<ContactSectionProps> = ({
    initialValues,
    onSave,
    saving,
}) => {
    const [form] = Form.useForm();

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={{
                agent: initialValues?.agent || { name: "", position: "" },
                phones: initialValues?.phones || [],
                emails: initialValues?.emails || [],
                websites: initialValues?.websites || [],
                addresses: initialValues?.addresses || [],
            }}
            onFinish={onSave}
        >
            <Divider>Default Agent</Divider>
            <div className="mb-4">
                <Alert
                    message="Fallback Agent Details"
                    description="These details will only be used when no agent is assigned to a deal. If an agent is assigned, their information will be displayed instead."
                    type="info"
                    showIcon
                />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <Form.Item name={["agent", "name"]} label="Agent Name">
                    <Input placeholder="Agent name" />
                </Form.Item>
                <Form.Item name={["agent", "position"]} label="Position">
                    <Input placeholder="Position/Title" />
                </Form.Item>
            </div>

            <Divider>Contact Information</Divider>

            {/* Phones */}
            <Form.List name="phones">
                {(fields, { add, remove }) => (
                    <div className="mb-4">
                        <label className="block mb-2 font-medium">
                            Phone Numbers
                        </label>
                        {fields.map(({ key, name }) => (
                            <Space key={key} className="mb-2">
                                <Form.Item name={name} noStyle>
                                    <Input placeholder="+1 234 567 8900" />
                                </Form.Item>
                                <Button
                                    type="text"
                                    danger
                                    onClick={() => remove(name)}
                                >
                                    <DeleteOutlined />
                                </Button>
                            </Space>
                        ))}
                        <Button
                            type="dashed"
                            onClick={() => add("")}
                            size="small"
                            block
                        >
                            <PlusOutlined /> Add Phone
                        </Button>
                    </div>
                )}
            </Form.List>

            {/* Emails */}
            <Form.List name="emails">
                {(fields, { add, remove }) => (
                    <div className="mb-4">
                        <label className="block mb-2 font-medium">Emails</label>
                        {fields.map(({ key, name }) => (
                            <Space key={key} className="mb-2">
                                <Form.Item name={name} noStyle>
                                    <Input placeholder="email@example.com" />
                                </Form.Item>
                                <Button
                                    type="text"
                                    danger
                                    onClick={() => remove(name)}
                                >
                                    <DeleteOutlined />
                                </Button>
                            </Space>
                        ))}
                        <Button
                            type="dashed"
                            onClick={() => add("")}
                            size="small"
                            block
                        >
                            <PlusOutlined /> Add Email
                        </Button>
                    </div>
                )}
            </Form.List>

            {/* Websites */}
            <Form.List name="websites">
                {(fields, { add, remove }) => (
                    <div className="mb-4">
                        <label className="block mb-2 font-medium">
                            Websites
                        </label>
                        {fields.map(({ key, name }) => (
                            <Space key={key} className="mb-2">
                                <Form.Item name={name} noStyle>
                                    <Input placeholder="https://..." />
                                </Form.Item>
                                <Button
                                    type="text"
                                    danger
                                    onClick={() => remove(name)}
                                >
                                    <DeleteOutlined />
                                </Button>
                            </Space>
                        ))}
                        <Button
                            type="dashed"
                            onClick={() => add("")}
                            size="small"
                            block
                        >
                            <PlusOutlined /> Add Website
                        </Button>
                    </div>
                )}
            </Form.List>

            <div className="mt-6">
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={saving}
                    icon={<SaveOutlined />}
                >
                    Save Contact Details
                </Button>
            </div>
        </Form>
    );
};

// ============================================
// Main Component
// ============================================

const ExposeConfig = ({
    pageTitle,
    project,
    config,
    groupedImageKeys,
    infoBlockKeys,
}: ExposeConfigProps) => {
    // Create mutations for each section
    const logoMutation = useApiMutate<
        { data: any },
        any,
        ApiSuccessResponse<any>
    >(
        route("developer-projects.expose-config.update-section", {
            id: project.id,
            section: "logo",
        }),
        "PATCH",
        () => router.reload({ only: ["config"] }),
    );

    const overviewMutation = useApiMutate<
        { data: any },
        any,
        ApiSuccessResponse<any>
    >(
        route("developer-projects.expose-config.update-section", {
            id: project.id,
            section: "project_overview",
        }),
        "PATCH",
        () => router.reload({ only: ["config"] }),
    );

    const groupedImagesMutation = useApiMutate<
        { data: any },
        any,
        ApiSuccessResponse<any>
    >(
        route("developer-projects.expose-config.update-section", {
            id: project.id,
            section: "grouped_images",
        }),
        "PATCH",
        () => router.reload({ only: ["config"] }),
    );

    const genericImagesMutation = useApiMutate<
        { data: any },
        any,
        ApiSuccessResponse<any>
    >(
        route("developer-projects.expose-config.update-section", {
            id: project.id,
            section: "generic_images",
        }),
        "PATCH",
        () => router.reload({ only: ["config"] }),
    );

    const contactMutation = useApiMutate<
        { data: any },
        any,
        ApiSuccessResponse<any>
    >(
        route("developer-projects.expose-config.update-section", {
            id: project.id,
            section: "contact_details",
        }),
        "PATCH",
        () => router.reload({ only: ["config"] }),
    );

    // Check if any mutation is pending
    const saving =
        logoMutation.isPending ||
        overviewMutation.isPending ||
        groupedImagesMutation.isPending ||
        genericImagesMutation.isPending ||
        contactMutation.isPending;

    // Preview Modal state
    const [previewModalOpen, setPreviewModalOpen] = useState(false);

    // Fetch preview data using useApiQuery
    const {
        data: previewResponse,
        isLoading: previewLoading,
        error: previewError,
        refetch: refetchPreview,
    } = useApiQuery<
        ApiSuccessResponse<{
            exposeData: any;
            project: { id: number; name: string; property_count: number };
        }>
    >({
        path: route("developer-projects.expose-config.preview", project.id),
        options: { enabled: previewModalOpen },
    });

    const handlePreview = () => {
        setPreviewModalOpen(true);
    };

    const previewData = previewResponse?.data;

    const tabItems: TabsProps["items"] = [
        {
            key: "logo",
            label: "Logo",
            children: (
                <LogoSection
                    initialValues={config?.logo || undefined}
                    onSave={(data) => logoMutation.mutateAsync({ data })}
                    saving={logoMutation.isPending}
                />
            ),
        },
        {
            key: "overview",
            label: "Project Overview",
            children: (
                <ProjectOverviewSection
                    initialValues={config?.project_overview || undefined}
                    onSave={(data) => overviewMutation.mutateAsync({ data })}
                    saving={overviewMutation.isPending}
                />
            ),
        },
        {
            key: "images",
            label: "Images",
            children: (
                <ImagesSection
                    groupedImageKeys={groupedImageKeys}
                    initialGrouped={config?.grouped_images || undefined}
                    initialGeneric={config?.generic_images || undefined}
                    onSave={async (data) => {
                        // Save both grouped and generic images
                        await Promise.all([
                            groupedImagesMutation.mutateAsync({
                                data: data.grouped_images,
                            }),
                            genericImagesMutation.mutateAsync({
                                data: data.generic_images,
                            }),
                        ]);
                    }}
                    saving={
                        groupedImagesMutation.isPending ||
                        genericImagesMutation.isPending
                    }
                />
            ),
        },
        {
            key: "contact",
            label: "Contact Details",
            children: (
                <ContactSection
                    initialValues={config?.contact_details || undefined}
                    onSave={(data) => contactMutation.mutateAsync({ data })}
                    saving={contactMutation.isPending}
                />
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
                {
                    name: project.name,
                    url: route("developer-projects.show", project.id),
                },
                { name: "Expose Config" },
            ]}
        >
            <div className="max-w-5xl mx-auto flex flex-col gap-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Link href={route("developer-projects.show", project.id)}>
                        <Button icon={<ArrowLeftOutlined />}>
                            Back to Project
                        </Button>
                    </Link>
                    {/* <Space>
                        <Button icon={<EyeOutlined />} onClick={handlePreview}>
                            Preview
                        </Button>
                    </Space> */}
                </div>

                {/* Location Warning */}
                {!project.location && (
                    <Alert
                        message="No Location Assigned"
                        description="This project has no location assigned. Location details will be empty in the expose. Please assign a location to the project."
                        type="warning"
                        showIcon
                    />
                )}

                {/* Config Tabs */}
                <Card>
                    <Tabs items={tabItems} />
                </Card>

                {/* Preview Modal */}
                <Modal
                    title="Expose Preview Data"
                    open={previewModalOpen}
                    onCancel={() => setPreviewModalOpen(false)}
                    width={800}
                    footer={[
                        <Button
                            key="close"
                            onClick={() => setPreviewModalOpen(false)}
                        >
                            Close
                        </Button>,
                        <Button
                            key="refresh"
                            type="primary"
                            onClick={() => refetchPreview()}
                            loading={previewLoading}
                        >
                            Refresh
                        </Button>,
                    ]}
                >
                    {previewLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Spin size="large" />
                        </div>
                    ) : previewError ? (
                        <Alert
                            type="error"
                            message="Failed to load preview"
                            description={
                                (previewError as any)?.message ||
                                "An error occurred while loading the preview data."
                            }
                            showIcon
                        />
                    ) : previewData ? (
                        <div className="space-y-6">
                            <Descriptions
                                title="Project Info"
                                bordered
                                column={2}
                                size="small"
                            >
                                <Descriptions.Item label="Name">
                                    {previewData.project?.name}
                                </Descriptions.Item>
                                <Descriptions.Item label="Property Count">
                                    {previewData.project?.property_count}
                                </Descriptions.Item>
                            </Descriptions>

                            <div>
                                <Typography.Title level={5}>
                                    Expose Data (JSON)
                                </Typography.Title>
                                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                                    {JSON.stringify(
                                        previewData.exposeData,
                                        null,
                                        2,
                                    )}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <Alert
                            type="info"
                            message="No preview data available"
                            description="Configure the expose settings and try again."
                            showIcon
                        />
                    )}
                </Modal>
            </div>
        </PageLayout>
    );
};

ExposeConfig.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default ExposeConfig;
