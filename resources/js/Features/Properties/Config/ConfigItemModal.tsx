import { useEffect } from "react";
import { Modal, Form, Input, Alert, Select } from "antd";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";
import type {
    PropertyConfigItem,
    PropertyConfigPayload,
    ConfigTypeSlug,
    ConfigCategoryMeta,
} from "@/Types/propertyConfig";

interface ConfigItemModalProps {
    open: boolean;
    onClose: () => void;
    activeType: ConfigTypeSlug;
    categoryMeta: ConfigCategoryMeta;
    editingItem: PropertyConfigItem | null;
    /** Pass cities for the areas type so user can pick parent city */
    cities?: { id: number; label: string }[];
    /** Pass primary categories for property-types so user can assign a category */
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
    const isEditing = !!editingItem;

    // Create mutation
    const createMutation = useApiMutate<
        PropertyConfigPayload,
        PropertyConfigItem,
        ApiSuccessResponse<PropertyConfigItem>
    >(route("property-config.store", { type: activeType }), "POST", () => {
        form.resetFields();
        onClose();
    });

    // Update mutation
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

    const isLoading = createMutation.isPending || updateMutation.isPending;

    // Populate form when editing
    useEffect(() => {
        if (open && editingItem) {
            form.setFieldsValue({
                name: editingItem.name,
                label: editingItem.label,
                description: editingItem.description ?? undefined,
                parent_type: editingItem.parent_type ?? undefined,
                city_id: editingItem.city_id ?? undefined,
                category: editingItem.category ?? undefined,
            });
        } else if (open) {
            form.resetFields();
        }
    }, [open, editingItem, form]);

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            // Clean up empty strings
            const payload: PropertyConfigPayload = {
                name: values.name.trim(),
                label: values.label.trim(),
                description: values.description?.trim() || null,
            };

            if (activeType === "sub-types" && values.parent_type) {
                payload.parent_type = values.parent_type.trim();
            }

            if (activeType === "areas" && values.city_id) {
                payload.city_id = values.city_id;
            }

            if (activeType === "property-types" && values.category) {
                payload.category = values.category;
            }

            if (isEditing) {
                updateMutation.mutate(payload);
            } else {
                createMutation.mutate(payload);
            }
        });
    };

    const title = isEditing
        ? `Edit ${categoryMeta.label.replace(/s$/, "")}`
        : `Add ${categoryMeta.label.replace(/s$/, "")}`;

    return (
        <Modal
            title={title}
            open={open}
            onOk={handleSubmit}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            okText={isEditing ? "Update" : "Create"}
            okButtonProps={{ loading: isLoading }}
            cancelButtonProps={{ disabled: isLoading }}
            destroyOnClose
            width={520}
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
                        name="name"
                        label="Name"
                        rules={[
                            { required: true, message: "Name is required" },
                            { max: 255, message: "Max 255 characters" },
                        ]}
                        tooltip="Internal identifier — must be unique. Use snake_case or UPPER_CASE (e.g. sea_view, APARTMENT)"
                    >
                        <Input placeholder="e.g. sea_view" />
                    </Form.Item>

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

                    <Form.Item
                        name="description"
                        label="Description"
                        rules={[{ max: 1000, message: "Max 1000 characters" }]}
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Optional description..."
                        />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};

export default ConfigItemModal;
