import React, { useState, useEffect } from "react";
import {
    Modal,
    Form,
    Input,
    Button,
    Avatar,
    Upload,
    message,
    Progress,
    Row,
    Col,
    Switch,
    InputNumber,
} from "antd";
import {
    UploadOutlined,
    LoadingOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import type { Developer } from "@/Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import { useFileUpload } from "@/Hooks/useFileUpload";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { TextArea } = Input;

interface DeveloperFormModalProps {
    open: boolean;
    onClose: () => void;
    developer?: Developer | null;
    onSuccess: () => void;
    /** Show the Hidden toggle (feature flag + edit permission). */
    canToggleHidden?: boolean;
}

interface CreateDeveloperInput {
    name: string;
    logo_url?: string;
    description?: string;
    whatsapp_group_link?: string;
    google_drive_link?: string;
    is_hidden?: boolean;
}

const DeveloperFormModal: React.FC<DeveloperFormModalProps> = ({
    open,
    onClose,
    developer,
    onSuccess,
    canToggleHidden = false,
}) => {
    const { td } = useTd();
    const [form] = Form.useForm();
    const isEditing = !!developer;
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    const {
        uploadSingle,
        isUploading: isUploadingLogo,
        aggregateProgress,
        reset: resetUpload,
    } = useFileUpload({
        maxFileSize: 2 * 1024 * 1024, // 2MB
        allowedTypes: [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/svg+xml",
        ],
        targetFolder: "developer-logos",
        onError: (error) => {
            message.error(error.message || "Logo upload failed");
        },
    });

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
            const payload = { ...values, logo_url: logoUrl || undefined };
            if (isEditing && developer) {
                updateMutation.mutate(payload);
            } else {
                createMutation.mutate(payload);
            }
        });
    };

    const handleLogoUpload = async (file: File) => {
        try {
            const result = await uploadSingle(file, "developer-logos");
            const url = result.downloadUrl;
            setLogoUrl(url);
            form.setFieldValue("logo_url", url);
        } catch {
            // error handled by onError callback
        }
        return false; // prevent antd default upload
    };

    const handleRemoveLogo = () => {
        setLogoUrl(null);
        form.setFieldValue("logo_url", undefined);
        resetUpload();
    };

    // Reset form when modal opens/closes or developer changes
    useEffect(() => {
        if (open) {
            if (developer) {
                form.setFieldsValue({
                    name: developer.name,
                    logo_url: developer.logo_url,
                    description: developer.description,
                    whatsapp_group_link: developer.whatsapp_group_link,
                    google_drive_link: developer.google_drive_link,
                    // Arrives as a decimal string from the API; InputNumber
                    // silently ignores a string, which left the field blank on
                    // every reopen and made a saved rate look unsaved.
                    commission_percentage:
                        developer.commission_percentage != null
                            ? Number(developer.commission_percentage)
                            : null,
                    is_hidden: !!developer.is_hidden,
                });
                setLogoUrl(developer.logo_url || null);
            } else {
                form.resetFields();
                setLogoUrl(null);
                form.setFieldsValue({ is_hidden: false });
            }
            resetUpload();
        }
    }, [open, developer, form]);

    return (
        <Modal
            title={isEditing ? "Edit Developer" : "Create Developer"}
            open={open}
            onCancel={() => !isLoading && onClose()}
            footer={[
                <Button key="cancel" onClick={onClose} disabled={isLoading}>
                    {td("Cancel", { source: "en" })}
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
                    label={td("Developer Name", { source: "en" })}
                    rules={[
                        {
                            required: true,
                            message: "Please enter the developer name",
                        },
                    ]}
                >
                    <Input placeholder={td("Enter developer name", { source: "en" })} />
                </Form.Item>

                <Form.Item name="logo_url" label={td("Logo", { source: "en" })} hidden>
                    <Input />
                </Form.Item>

                <Form.Item label={td("Logo", { source: "en" })}>
                    {logoUrl ? (
                        <div className="flex items-center gap-4">
                            <Avatar
                                size={80}
                                src={logoUrl}
                                shape="square"
                                className="border border-gray-200"
                            />
                            <Button
                                type="text"
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={handleRemoveLogo}
                                disabled={isLoading}
                            >
                                {td("Remove", { source: "en" })}
                            </Button>
                        </div>
                    ) : (
                        <Upload.Dragger
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            showUploadList={false}
                            multiple={false}
                            beforeUpload={(file) => {
                                handleLogoUpload(file);
                                return false;
                            }}
                            disabled={isUploadingLogo || isLoading}
                            className="!p-4"
                        >
                            {isUploadingLogo ? (
                                <div className="text-center">
                                    <LoadingOutlined className="text-2xl text-blue-500 mb-2" />
                                    <p className="text-sm text-gray-500 mb-1">
                                        {td("Uploading...", { source: "en" })}
                                    </p>
                                    <Progress
                                        percent={
                                            aggregateProgress.overallProgress
                                        }
                                        size="small"
                                        showInfo={false}
                                    />
                                </div>
                            ) : (
                                <div className="text-center">
                                    <UploadOutlined className="text-2xl text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-600">
                                        {td("Click or drag logo image", { source: "en" })}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {td("PNG, JPG, WebP or SVG (max 2MB)", { source: "en" })}
                                    </p>
                                </div>
                            )}
                        </Upload.Dragger>
                    )}
                </Form.Item>

                <Form.Item name="description" label={td("Description", { source: "en" })}>
                    <TextArea
                        placeholder={td("Enter developer description", { source: "en" })}
                        rows={4}
                    />
                </Form.Item>

                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Form.Item
                            name="whatsapp_group_link"
                            label={td("WhatsApp Group Link", { source: "en" })}
                            rules={[
                                {
                                    type: "url",
                                    message: "Please enter a valid URL",
                                },
                            ]}
                        >
                            <Input placeholder="https://chat.whatsapp.com/..." />
                        </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                        <Form.Item
                            name="google_drive_link"
                            label={td("Google Drive Link", { source: "en" })}
                            rules={[
                                {
                                    type: "url",
                                    message: "Please enter a valid URL",
                                },
                            ]}
                        >
                            <Input placeholder="https://drive.google.com/..." />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="commission_percentage"
                    label={td("Commission Percentage", { source: "en" })}
                    extra="Maximum total commission on deals for this developer's projects, shared across the agent, their uplines and the company. Leave empty to use the company default. A project can override it."
                >
                    <InputNumber
                        min={0}
                        max={100}
                        step={0.5}
                        className="w-full"
                        addonAfter="%"
                        placeholder={td("Company default", { source: "en" })}
                    />
                </Form.Item>

                {canToggleHidden && (
                    <Form.Item
                        name="is_hidden"
                        label={td("Hide from view-only users", { source: "en" })}
                        valuePropName="checked"
                        extra="When enabled, users without edit access will not see this developer or any of its projects."
                    >
                        <Switch />
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
};

export default DeveloperFormModal;
