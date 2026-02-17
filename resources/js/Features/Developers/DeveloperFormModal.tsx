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

const { TextArea } = Input;

interface DeveloperFormModalProps {
    open: boolean;
    onClose: () => void;
    developer?: Developer | null;
    onSuccess: () => void;
}

interface CreateDeveloperInput {
    name: string;
    logo_url?: string;
    description?: string;
    whatsapp_group_link?: string;
}

const DeveloperFormModal: React.FC<DeveloperFormModalProps> = ({
    open,
    onClose,
    developer,
    onSuccess,
}) => {
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
                });
                setLogoUrl(developer.logo_url || null);
            } else {
                form.resetFields();
                setLogoUrl(null);
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

                <Form.Item name="logo_url" label="Logo" hidden>
                    <Input />
                </Form.Item>

                <Form.Item label="Logo">
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
                                Remove
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
                                        Uploading...
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
                                        Click or drag logo image
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        PNG, JPG, WebP or SVG (max 2MB)
                                    </p>
                                </div>
                            )}
                        </Upload.Dragger>
                    )}
                </Form.Item>

                <Form.Item name="description" label="Description">
                    <TextArea
                        placeholder="Enter developer description"
                        rows={4}
                    />
                </Form.Item>

                <Form.Item
                    name="whatsapp_group_link"
                    label="WhatsApp Group Link"
                    rules={[
                        {
                            type: "url",
                            message: "Please enter a valid URL",
                        },
                    ]}
                >
                    <Input placeholder="https://chat.whatsapp.com/..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default DeveloperFormModal;
