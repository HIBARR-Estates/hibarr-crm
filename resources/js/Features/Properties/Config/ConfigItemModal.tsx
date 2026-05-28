import { useEffect, useState } from "react";
import {
    Modal,
    Form,
    Input,
    Alert,
    Select,
    Typography,
    InputNumber,
    Divider,
    Row,
    Col,
    Upload,
    message,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";
import type {
    PropertyConfigItem,
    PropertyConfigPayload,
    ConfigTypeSlug,
    ConfigCategoryMeta,
} from "@/Types/propertyConfig";
import { DISTANCE_FIELDS } from "@/Features/Properties/SaveProperty/constructionProjectConfig";
import {
    FACILITY_ICON_OPTIONS,
    getFacilityIconComponent,
} from "@/lib/facilityIcons";
import HtmlEditor from "@/Components/HtmlEditor";
import { getFileUploadService } from "@/Services/FileUploadService";
import type { RcFile } from "antd/lib/upload";

const { Text } = Typography;

const toSnakeCase = (label: string): string =>
    label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");

interface ConfigItemModalProps {
    open: boolean;
    onClose: () => void;
    activeType: ConfigTypeSlug;
    categoryMeta: ConfigCategoryMeta;
    editingItem: PropertyConfigItem | null;
    cities?: { id: number; label: string }[];
    primaryCategories?: { name: string; label: string }[];
}

const ConfigItemModal = ({
    open,
    onClose,
    activeType,
    categoryMeta,
    editingItem,
    cities,
    primaryCategories,
}: ConfigItemModalProps) => {
    const [form] = Form.useForm<PropertyConfigPayload>();
    const [imageFile, setImageFile] = useState<RcFile | null>(null);
    const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(
        null,
    );
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const isEditing = !!editingItem;
    const supportsImageUpload =
        activeType === "cities" ||
        activeType === "project-facilities" ||
        activeType === "airports" ||
        activeType === "infrastructures";

    const createMutation = useApiMutate<
        PropertyConfigPayload,
        PropertyConfigItem,
        ApiSuccessResponse<PropertyConfigItem>
    >(route("property-config.store", { type: activeType }), "POST", () => {
        form.resetFields();
        onClose();
    });

    const updateMutation = useApiMutate<
        PropertyConfigPayload,
        PropertyConfigItem,
        ApiSuccessResponse<PropertyConfigItem>
    >(
        editingItem
            ? route("property-config.update", {
                  type: activeType,
                  id: editingItem.id,
              })
            : "",
        "PUT",
        () => {
            form.resetFields();
            onClose();
        },
    );

    const labelValue = Form.useWatch("label", form);

    useEffect(() => {
        if (open && !isEditing && labelValue) {
            form.setFieldValue("name", toSnakeCase(labelValue));
        }
    }, [labelValue, open, isEditing, form]);

    useEffect(() => {
        if (open && editingItem) {
            form.setFieldsValue({
                name: editingItem.name,
                label: editingItem.label,
                description: editingItem.description ?? undefined,
                parent_type: editingItem.parent_type ?? undefined,
                city_id: editingItem.city_id ?? undefined,
                category: editingItem.category ?? undefined,
                icon: editingItem.icon ?? undefined,
                code: editingItem.code ?? undefined,
            });

            if (supportsImageUpload && editingItem.image_url) {
                setUploadedImageUrl(editingItem.image_url);
            }

            if (
                activeType === "cities" &&
                (editingItem as any).default_distances
            ) {
                const distances = (editingItem as any).default_distances;
                DISTANCE_FIELDS.forEach((field) => {
                    if (distances[field.key] != null) {
                        form.setFieldValue(
                            ["default_distances", field.key],
                            distances[field.key],
                        );
                    }
                });
            }
        } else if (open) {
            form.resetFields();
            setImageFile(null);
            setUploadedImageUrl(null);
        }
    }, [open, editingItem, form, activeType, supportsImageUpload]);

    const handleSubmit = async () => {
        const values = await form.validateFields();
        let imageUrl = uploadedImageUrl;

        if (imageFile && supportsImageUpload) {
            try {
                setIsUploadingImage(true);
                const uploadService = getFileUploadService();
                const folder =
                    activeType === "cities"
                        ? "property-cities"
                        : activeType === "project-facilities"
                          ? "property-project-facilities"
                          : activeType === "airports"
                            ? "property-airports"
                            : "property-infrastructures";
                const uploadResult = await uploadService.uploadSingle(
                    imageFile,
                    folder,
                );
                imageUrl = uploadResult.downloadUrl;
                message.success("Image uploaded successfully");
            } catch (error) {
                const errorMsg =
                    error instanceof Error
                        ? error.message
                        : "Failed to upload image";
                message.error(errorMsg);
                setIsUploadingImage(false);
                return;
            } finally {
                setIsUploadingImage(false);
            }
        }

        const payload: PropertyConfigPayload = {
            label: values.label.trim(),
            description:
                activeType === "cities"
                    ? values.description || null
                    : values.description?.trim() || null,
        };

        if (!isEditing) {
            payload.name = values.name?.trim() || toSnakeCase(values.label);
        }

        if (activeType === "sub-types" && values.parent_type) {
            payload.parent_type = values.parent_type.trim();
        }

        if (activeType === "areas" && values.city_id) {
            payload.city_id = values.city_id;
        }

        if (activeType === "property-types" && values.category) {
            payload.category = values.category;
        }

        if (activeType === "project-facilities") {
            payload.icon = values.icon || null;
        }

        if (activeType === "infrastructures") {
            payload.icon = values.icon?.trim() || null;
        }

        if (activeType === "airports") {
            payload.code = values.code?.trim() || null;
        }

        if (activeType === "cities") {
            const distances = (values as any).default_distances;
            if (distances) {
                (payload as any).default_distances = distances;
            }
        }

        if (supportsImageUpload && imageUrl) {
            payload.image_url = imageUrl;
        }

        if (isEditing) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    const title = isEditing
        ? `Edit ${categoryMeta.label.replace(/s$/, "")}`
        : `Add ${categoryMeta.label.replace(/s$/, "")}`;

    const renderImageUploader = (label: string, hint: string) => (
        <Form.Item label={label} tooltip={hint}>
            <Upload.Dragger
                accept="image/*"
                maxCount={1}
                beforeUpload={(file: RcFile) => {
                    const isImage = file.type.startsWith("image/");
                    if (!isImage) {
                        message.error("Only image files are allowed");
                        return false;
                    }

                    const isLt10M = file.size / 1024 / 1024 < 10;
                    if (!isLt10M) {
                        message.error("Image must be smaller than 10MB");
                        return false;
                    }

                    setImageFile(file);
                    return false;
                }}
                onRemove={() => {
                    setImageFile(null);
                    setUploadedImageUrl(null);
                }}
            >
                {uploadedImageUrl || imageFile ? (
                    <div className="text-center py-4">
                        <img
                            src={
                                imageFile
                                    ? URL.createObjectURL(imageFile)
                                    : uploadedImageUrl!
                            }
                            alt="Default"
                            style={{ maxHeight: "200px", maxWidth: "100%" }}
                        />
                        <p className="mt-2 text-sm text-gray-600">
                            {imageFile
                                ? `Selected: ${imageFile.name}`
                                : "Existing image"}
                        </p>
                    </div>
                ) : (
                    <div>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">
                            Click or drag image here
                        </p>
                        <p className="ant-upload-hint">
                            Supported: JPG, PNG, GIF (Max 10MB)
                        </p>
                    </div>
                )}
            </Upload.Dragger>
        </Form.Item>
    );

    return (
        <Modal
            title={title}
            open={open}
            onOk={handleSubmit}
            onCancel={() => {
                form.resetFields();
                setImageFile(null);
                setUploadedImageUrl(null);
                onClose();
            }}
            okText={isEditing ? "Update" : "Create"}
            okButtonProps={{
                loading:
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    isUploadingImage,
            }}
            cancelButtonProps={{
                disabled:
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    isUploadingImage,
            }}
            destroyOnClose
            width={
                activeType === "cities"
                    ? 700
                    : activeType === "project-facilities" ||
                        activeType === "airports" ||
                        activeType === "infrastructures"
                      ? 560
                      : 520
            }
        >
            <div className="pt-4">
                <Alert
                    message={categoryMeta.description}
                    type="info"
                    showIcon
                    className="mb-4"
                />

                <Form form={form} layout="vertical" requiredMark="optional">
                    <Form.Item
                        name="label"
                        label="Display Label"
                        rules={[
                            {
                                required: true,
                                message: "Display label is required",
                            },
                            { max: 255, message: "Max 255 characters" },
                        ]}
                        tooltip="User-facing label shown in dropdowns and forms"
                    >
                        <Input placeholder="e.g. Sea View" />
                    </Form.Item>

                    <Form.Item name="name" hidden>
                        <Input type="hidden" />
                    </Form.Item>

                    {activeType === "sub-types" && (
                        <Form.Item
                            name="parent_type"
                            label="Parent Type"
                            tooltip="The parent property type this sub-type belongs to"
                        >
                            <Input placeholder="e.g. APARTMENT" />
                        </Form.Item>
                    )}

                    {activeType === "areas" && (
                        <Form.Item
                            name="city_id"
                            label="City"
                            rules={[
                                {
                                    required: true,
                                    message: "City is required for areas",
                                },
                            ]}
                            tooltip="The city this area belongs to"
                        >
                            <Select
                                placeholder="Select city"
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                options={(cities || []).map((c) => ({
                                    value: c.id,
                                    label: c.label,
                                }))}
                            />
                        </Form.Item>
                    )}

                    {activeType === "property-types" && (
                        <Form.Item
                            name="category"
                            label="Primary Category"
                            rules={[
                                {
                                    required: true,
                                    message:
                                        "Category is required for property types",
                                },
                            ]}
                            tooltip="The primary category this property type belongs to (Residential, Commercial, or Land)"
                        >
                            <Select
                                placeholder="Select category"
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                options={(primaryCategories || []).map((c) => ({
                                    value: c.name,
                                    label: c.label,
                                }))}
                            />
                        </Form.Item>
                    )}

                    {activeType === "airports" && (
                        <Form.Item
                            name="code"
                            label="Airport Code"
                            rules={[
                                { max: 10, message: "Max 10 characters" },
                            ]}
                            tooltip="Optional airport code (e.g. ECN, LCA)"
                        >
                            <Input placeholder="e.g. ECN" />
                        </Form.Item>
                    )}

                    {activeType === "cities" ? (
                        <Form.Item name="description" label="Description">
                            <HtmlEditor
                                height={200}
                                placeholder="Optional description..."
                            />
                        </Form.Item>
                    ) : (
                        <Form.Item
                            name="description"
                            label="Description"
                            rules={[
                                { max: 1000, message: "Max 1000 characters" },
                            ]}
                        >
                            <Input.TextArea
                                rows={3}
                                placeholder="Optional description..."
                            />
                        </Form.Item>
                    )}

                    {activeType === "cities" && (
                        <>
                            <Divider orientation="left" plain>
                                Default Distances (km)
                            </Divider>
                            <Row gutter={[12, 0]}>
                                {DISTANCE_FIELDS.map((field) => (
                                    <Col xs={12} md={8} key={field.key}>
                                        <Form.Item
                                            name={["default_distances", field.key]}
                                            label={field.label}
                                        >
                                            <InputNumber
                                                min={0}
                                                max={500}
                                                step={0.1}
                                                placeholder="0.0"
                                                style={{ width: "100%" }}
                                                addonAfter="km"
                                            />
                                        </Form.Item>
                                    </Col>
                                ))}
                            </Row>
                            {renderImageUploader(
                                "City Image",
                                "Upload an image to represent this city",
                            )}
                        </>
                    )}

                    {activeType === "project-facilities" && (
                        <>
                            <Form.Item
                                name="icon"
                                label="Icon"
                                tooltip="Select an icon to represent this facility"
                            >
                                <Select
                                    placeholder="Select an icon"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    options={FACILITY_ICON_OPTIONS.map((opt) => ({
                                        value: opt.value,
                                        label: opt.label,
                                    }))}
                                    optionRender={(option) => {
                                        const IconComp =
                                            getFacilityIconComponent(
                                                option.value as string,
                                            );
                                        return (
                                            <div className="flex items-center gap-2">
                                                <IconComp size={16} />
                                                <span>{option.label}</span>
                                            </div>
                                        );
                                    }}
                                />
                            </Form.Item>
                            {renderImageUploader(
                                "Default Image",
                                "Used in expose when no image is tagged for this facility",
                            )}
                        </>
                    )}

                    {activeType === "infrastructures" && (
                        <Form.Item
                            name="icon"
                            label="Icon"
                            rules={[
                                { max: 100, message: "Max 100 characters" },
                            ]}
                            tooltip="Optional icon identifier"
                        >
                            <Input placeholder="e.g. heart-pulse" />
                        </Form.Item>
                    )}

                    {(activeType === "airports" ||
                        activeType === "infrastructures") &&
                        renderImageUploader(
                            "Default Image",
                            "Upload a default image used for this item",
                        )}
                </Form>
            </div>
        </Modal>
    );
};

export default ConfigItemModal;
