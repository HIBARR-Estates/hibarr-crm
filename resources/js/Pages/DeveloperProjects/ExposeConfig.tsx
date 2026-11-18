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
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
    const [form] = Form.useForm();

    const handleMockUpload = async (file: File, field: "dark" | "light") => {
        const url = await mockUploadFile(file, "logo");
        form.setFieldValue(field, url);
        message.info(td("Mock upload complete - placeholder URL generated", { source: "en" }));
    };

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            onFinish={onSave}
        >
            <div className="grid grid-cols-2 gap-6">
                <Form.Item name="dark" label={td("Dark Logo URL", { source: "en" })}>
                    <Input placeholder={td("URL to dark version of logo", { source: "en" })} />
                </Form.Item>
                <Form.Item name="light" label={td("Light Logo URL", { source: "en" })}>
                    <Input placeholder={td("URL to light version of logo", { source: "en" })} />
                </Form.Item>
            </div>
            <div className="mb-4">
                <Alert
                    message={td("File Upload Note", { source: "en" })}
                    description={td("File storage is not yet implemented. Enter URLs directly or use mock upload for testing.", { source: "en" })}
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
                {td("Save Logo Settings", { source: "en" })}
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
    const { td } = useTd();
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
                <Form.Item name="city" label={td("City", { source: "en" })}>
                    <Input placeholder={td("Project city", { source: "en" })} />
                </Form.Item>
                <Form.Item name="completionDate" label={td("Completion Date", { source: "en" })}>
                    <DatePicker
                        placeholder={td("Select completion date", { source: "en" })}
                        style={{ width: "100%" }}
                        format="YYYY-MM-DD"
                    />
                </Form.Item>
            </div>

            <Form.Item name="propertyOverviewImage" label={td("Overview Image URL", { source: "en" })}>
                <Input placeholder={td("URL to main overview image", { source: "en" })} />
            </Form.Item>

            <Divider>{td("Property Types", { source: "en" })}</Divider>
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
                                            placeholder={td("Type", { source: "en" })}
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
                            <PlusOutlined /> {td("Add Type", { source: "en" })}
                        </Button>
                    </>
                )}
            </Form.List>

            <Divider>{td("Facilities", { source: "en" })}</Divider>
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
                                        <Input placeholder={td("Facility name", { source: "en" })} />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, "image"]}
                                        noStyle
                                    >
                                        <Input
                                            placeholder={td("Image URL", { source: "en" })}
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
                            <PlusOutlined /> {td("Add Facility", { source: "en" })}
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
                    {td("Save Overview", { source: "en" })}
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
    const { td } = useTd();
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
                    message={td("Image URLs", { source: "en" })}
                    description={td("Enter image URLs directly. File upload functionality will be added later.", { source: "en" })}
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
                                                placeholder={td("Image URL", { source: "en" })}
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
                                    <PlusOutlined /> {td("Add Image", { source: "en" })}
                                </Button>
                            </>
                        )}
                    </Form.List>
                </Card>
            ))}

            <Card title={td("Generic Images", { source: "en" })} size="small" className="mb-4">
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
                                            placeholder={td("Image URL", { source: "en" })}
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
                                <PlusOutlined /> {td("Add Image", { source: "en" })}
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
                {td("Save Images", { source: "en" })}
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
    const { td } = useTd();
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
            <Divider>{td("Default Agent", { source: "en" })}</Divider>
            <div className="mb-4">
                <Alert
                    message={td("Fallback Agent Details", { source: "en" })}
                    description={td("These details will only be used when no agent is assigned to a deal. If an agent is assigned, their information will be displayed instead.", { source: "en" })}
                    type="info"
                    showIcon
                />
            </div>
            <div className="grid grid-cols-2 gap-6">
                <Form.Item name={["agent", "name"]} label={td("Agent Name", { source: "en" })}>
                    <Input placeholder={td("Agent name", { source: "en" })} />
                </Form.Item>
                <Form.Item name={["agent", "position"]} label={td("Position", { source: "en" })}>
                    <Input placeholder={td("Position/Title", { source: "en" })} />
                </Form.Item>
            </div>

            <Divider>{td("Contact Information", { source: "en" })}</Divider>

            {/* Phones */}
            <Form.List name="phones">
                {(fields, { add, remove }) => (
                    <div className="mb-4">
                        <label className="block mb-2 font-medium">
                            {td("Phone Numbers", { source: "en" })}
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
                            <PlusOutlined /> {td("Add Phone", { source: "en" })}
                        </Button>
                    </div>
                )}
            </Form.List>

            {/* Emails */}
            <Form.List name="emails">
                {(fields, { add, remove }) => (
                    <div className="mb-4">
                        <label className="block mb-2 font-medium">{td("Emails", { source: "en" })}</label>
                        {fields.map(({ key, name }) => (
                            <Space key={key} className="mb-2">
                                <Form.Item name={name} noStyle>
                                    <Input placeholder={td("email@example.com", { source: "en" })} />
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
                            <PlusOutlined /> {td("Add Email", { source: "en" })}
                        </Button>
                    </div>
                )}
            </Form.List>

            {/* Websites */}
            <Form.List name="websites">
                {(fields, { add, remove }) => (
                    <div className="mb-4">
                        <label className="block mb-2 font-medium">
                            {td("Websites", { source: "en" })}
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
                            <PlusOutlined /> {td("Add Website", { source: "en" })}
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
                    {td("Save Contact Details", { source: "en" })}
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
    const { td } = useTd();
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
            label: td("Logo", { source: "en" }),
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
            label: td("Project Overview", { source: "en" }),
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
            label: td("Images", { source: "en" }),
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
            label: td("Contact Details", { source: "en" }),
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
                    name: "Projects",
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
                            {td("Back to Project", { source: "en" })}
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
                        message={td("No Location Assigned", { source: "en" })}
                        description={td("This project has no location assigned. Location details will be empty in the expose. Please assign a location to the project.", { source: "en" })}
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
                    title={td("Expose Preview Data", { source: "en" })}
                    open={previewModalOpen}
                    onCancel={() => setPreviewModalOpen(false)}
                    width={800}
                    footer={[
                        <Button
                            key="close"
                            onClick={() => setPreviewModalOpen(false)}
                        >
                            {td("Close", { source: "en" })}
                        </Button>,
                        <Button
                            key="refresh"
                            type="primary"
                            onClick={() => refetchPreview()}
                            loading={previewLoading}
                        >
                            {td("Refresh", { source: "en" })}
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
                            message={td("Failed to load preview", { source: "en" })}
                            description={
                                (previewError as any)?.message ||
                                "An error occurred while loading the preview data."
                            }
                            showIcon
                        />
                    ) : previewData ? (
                        <div className="space-y-6">
                            <Descriptions
                                title={td("Project Info", { source: "en" })}
                                bordered
                                column={2}
                                size="small"
                            >
                                <Descriptions.Item label={td("Name", { source: "en" })}>
                                    {previewData.project?.name}
                                </Descriptions.Item>
                                <Descriptions.Item label={td("Property Count", { source: "en" })}>
                                    {previewData.project?.property_count}
                                </Descriptions.Item>
                            </Descriptions>

                            <div>
                                <Typography.Title level={5}>
                                    {td("Expose Data (JSON)", { source: "en" })}
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
                            message={td("No preview data available", { source: "en" })}
                            description={td("Configure the expose settings and try again.", { source: "en" })}
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
