import { useEffect } from "react";
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
} from "antd";
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

const { Text } = Typography;

/**
 * Normalize a display label into a snake_case machine key.
 * e.g. "Sea Front Villa" → "sea_front_villa"
 *      "Air Condition (Split)" → "air_condition_split"
 */
const toSnakeCase = (label: string): string =>
    label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, "") // strip special chars
        .replace(/\s+/g, "_") // spaces → underscores
        .replace(/_+/g, "_") // collapse multiple underscores
        .replace(/^_|_$/g, ""); // trim leading/trailing underscores

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

    // Watch label to auto-generate name in create mode
    const labelValue = Form.useWatch("label", form);

    useEffect(() => {
        if (open && !isEditing && labelValue) {
            form.setFieldValue("name", toSnakeCase(labelValue));
        }
    }, [labelValue, open, isEditing, form]);

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
                icon: editingItem.icon ?? undefined,
            });

            // Populate default distances for cities
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
        }
    }, [open, editingItem, form, activeType]);

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            const payload: PropertyConfigPayload = {
                label: values.label.trim(),
                description: values.description?.trim() || null,
            };

            // Only send name on create (server auto-generates if empty, locked on edit)
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

            if (activeType === "cities") {
                const distances = (values as any).default_distances;
                if (distances) {
                    (payload as any).default_distances = distances;
                }
            }

            if (activeType === "project-facilities") {
                payload.icon = values.icon || null;
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
            width={
                activeType === "cities"
                    ? 640
                    : activeType === "project-facilities"
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

                    {/* Name field hidden — auto-generated from label on the backend */}
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

                    {activeType === "cities" && (
                        <>
                            <Divider orientation="left" plain>
                                Default Distances (km)
                            </Divider>
                            <Row gutter={[12, 0]}>
                                {DISTANCE_FIELDS.map((field) => (
                                    <Col xs={12} md={8} key={field.key}>
                                        <Form.Item
                                            name={[
                                                "default_distances",
                                                field.key,
                                            ]}
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
                        </>
                    )}

                    {activeType === "project-facilities" && (
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
                                options={FACILITY_ICON_OPTIONS.map((opt) => {
                                    const IconComp = opt.component;
                                    return {
                                        value: opt.value,
                                        label: opt.label,
                                    };
                                })}
                                optionRender={(option) => {
                                    const IconComp = getFacilityIconComponent(
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
                    )}
                </Form>
            </div>
        </Modal>
    );
};

export default ConfigItemModal;
