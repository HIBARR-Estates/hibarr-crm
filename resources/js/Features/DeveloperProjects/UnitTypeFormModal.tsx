/**
 * UnitTypeFormModal — create / edit a unit type for a developer project.
 *
 * Uses Ant Design Modal + Form with sectioned layout.
 * API calls via useApiMutate (TanStack Query).
 */

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    Radio,
    Checkbox,
    DatePicker,
    Switch,
    Divider,
    Row,
    Col,
    Typography,
    Alert,
    Button,
    App,
    message,
} from "antd";
import { PictureOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";
import type { DeveloperProjectUnitType } from "@/Types/developerProject";
import {
    PRIMARY_CATEGORY_OPTIONS,
    RESIDENTIAL_PROPERTY_TYPES,
    COMMERCIAL_PROPERTY_TYPES,
    getPropertyTypesForCategory,
    UNIT_STYLE_OPTIONS,
    VIEW_TYPE_OPTIONS,
    FURNITURE_STATUS_OPTIONS,
    CURRENCY_OPTIONS,
    BEDROOM_OPTIONS,
    BATHROOM_OPTIONS,
    FLOOR_OPTIONS,
    FLOORS_IN_BUILDING_OPTIONS,
    OUTSIDE_FEATURE_OPTIONS,
    INSIDE_FEATURE_OPTIONS,
} from "@/Features/DeveloperProjects/unitTypeConfig";
import UnitTypePhotosSection from "@/Features/DeveloperProjects/UnitTypePhotosSection";

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================
// Types
// ============================================

interface UnitTypeFormValues {
    primary_category: "residential" | "commercial";
    property_type: string | null;
    unit_style: string[];
    view_types: string[];
    furniture_status: string | null;
    starting_price: number | null;
    currency: string;
    bedrooms: number | null;
    bathrooms: number | null;
    floor: string | null;
    floors_in_building: number | null;
    total_area_sqm: number | null;
    living_area_sqm: number | null;
    terrace_balcony_sqm: number | null;
    plot_size_sqm: number | null;
    completion_date: any; // dayjs object from DatePicker
    outside_features: string[];
    inside_features: string[];
    description: string | null;
    military_base_distance_km: number | null;
    has_restrictions: boolean;
    restriction_notes: string | null;
    reference_code: string | null;
}

interface UnitTypeFormModalProps {
    open: boolean;
    onClose: () => void;
    projectId: number;
    editingItem?: DeveloperProjectUnitType | null;
    onSuccess?: () => void;
}

// ============================================
// Component
// ============================================

const UnitTypeFormModal: React.FC<UnitTypeFormModalProps> = ({
    open,
    onClose,
    projectId,
    editingItem,
    onSuccess,
}) => {
    const [form] = Form.useForm<UnitTypeFormValues>();
    const isEditing = !!editingItem;
    const { modal } = App.useApp();

    // ── "Save & Continue" state — allows create mode to transition to edit-like state ──
    const [localUnitType, setLocalUnitType] =
        useState<DeveloperProjectUnitType | null>(null);
    const saveForUploadRef = useRef(false);

    // The effective unit type is the prop (edit mode) or the locally-saved one (save & continue)
    const effectiveUnitType = editingItem ?? localUnitType;
    const effectiveUnitTypeId = effectiveUnitType?.id;
    const isEffectivelyEditing = !!effectiveUnitTypeId;

    // Reset local state when modal closes
    useEffect(() => {
        if (!open) {
            setLocalUnitType(null);
            saveForUploadRef.current = false;
        }
    }, [open]);

    // Watch primary_category for conditional fields
    const primaryCategory = Form.useWatch("primary_category", form);
    const hasRestrictions = Form.useWatch("has_restrictions", form);

    // Derive property type options based on selected category
    const propertyTypeOptions = useMemo(
        () => getPropertyTypesForCategory(primaryCategory ?? null),
        [primaryCategory],
    );

    // ---- API Mutations ----

    const createMutation = useApiMutate<
        Record<string, any>,
        DeveloperProjectUnitType,
        ApiSuccessResponse<DeveloperProjectUnitType>
    >(
        route("developer-projects.unit-types.store", { projectId }),
        "POST",
        (res) => {
            // If this was a "save & continue" flow, stay on the form
            if (saveForUploadRef.current) {
                saveForUploadRef.current = false;
                const created = (res?.data as any)?.unit_type || res?.data;
                if (created?.id) {
                    setLocalUnitType(created as DeveloperProjectUnitType);
                }
                message.success("Unit type saved! You can now upload photos.");
                return;
            }

            form.resetFields();
            onClose();
            onSuccess?.();
        },
    );

    const updateMutation = useApiMutate<
        Record<string, any>,
        DeveloperProjectUnitType,
        ApiSuccessResponse<DeveloperProjectUnitType>
    >(
        effectiveUnitTypeId
            ? route("developer-projects.unit-types.update", {
                  projectId,
                  unitTypeId: effectiveUnitTypeId,
              })
            : "",
        "PUT",
        () => {
            form.resetFields();
            handleClose();
            onSuccess?.();
        },
    );

    const isLoading = createMutation.isPending || updateMutation.isPending;

    // ---- Populate form on edit ----

    useEffect(() => {
        if (open && editingItem) {
            form.setFieldsValue({
                primary_category: editingItem.primary_category,
                property_type: editingItem.property_type,
                unit_style: editingItem.unit_style ?? [],
                view_types: editingItem.view_types ?? [],
                furniture_status: editingItem.furniture_status,
                starting_price: editingItem.starting_price
                    ? Number(editingItem.starting_price)
                    : null,
                currency: editingItem.currency ?? "GBP",
                bedrooms: editingItem.bedrooms,
                bathrooms: editingItem.bathrooms,
                floor: editingItem.floor,
                floors_in_building: editingItem.floors_in_building,
                total_area_sqm: editingItem.total_area_sqm
                    ? Number(editingItem.total_area_sqm)
                    : null,
                living_area_sqm: editingItem.living_area_sqm
                    ? Number(editingItem.living_area_sqm)
                    : null,
                terrace_balcony_sqm: editingItem.terrace_balcony_sqm
                    ? Number(editingItem.terrace_balcony_sqm)
                    : null,
                plot_size_sqm: editingItem.plot_size_sqm
                    ? Number(editingItem.plot_size_sqm)
                    : null,
                completion_date: editingItem.completion_date
                    ? dayjs(editingItem.completion_date)
                    : null,
                outside_features: editingItem.outside_features ?? [],
                inside_features: editingItem.inside_features ?? [],
                description: editingItem.description,
                military_base_distance_km: editingItem.military_base_distance_km
                    ? Number(editingItem.military_base_distance_km)
                    : null,
                has_restrictions: editingItem.has_restrictions ?? false,
                restriction_notes: editingItem.restriction_notes,
                reference_code: editingItem?.reference_code,
            });
        } else if (open) {
            form.resetFields();
            form.setFieldsValue({
                primary_category: "residential",
                currency: "GBP",
                has_restrictions: false,
                unit_style: [],
                view_types: [],
                outside_features: [],
                inside_features: [],
            });
        }
    }, [open, editingItem, form]);

    // ---- Reset property_type when category changes ----

    useEffect(() => {
        if (!open) return;
        const currentType = form.getFieldValue("property_type");
        const validValues = propertyTypeOptions.map((o) => o.value);
        if (currentType && !validValues.includes(currentType)) {
            form.setFieldValue("property_type", null);
        }
        // Clear unit_style for commercial
        if (primaryCategory === "commercial") {
            form.setFieldValue("unit_style", []);
        }
    }, [primaryCategory, open]);

    // ---- Submit ----

    const doSubmit = useCallback(
        (isSaveForUpload = false) => {
            form.validateFields().then((values) => {
                const payload: Record<string, any> = {
                    ...values,
                    completion_date: values.completion_date
                        ? values.completion_date.format("YYYY-MM-DD")
                        : null,
                    unit_style:
                        values.unit_style?.length > 0
                            ? values.unit_style
                            : null,
                    view_types:
                        values.view_types?.length > 0
                            ? values.view_types
                            : null,
                    outside_features:
                        values.outside_features?.length > 0
                            ? values.outside_features
                            : null,
                    inside_features:
                        values.inside_features?.length > 0
                            ? values.inside_features
                            : null,
                };

                if (isSaveForUpload) {
                    saveForUploadRef.current = true;
                }

                if (isEffectivelyEditing) {
                    updateMutation.mutate(payload);
                } else {
                    createMutation.mutate(payload);
                }
            });
        },
        [form, isEffectivelyEditing, createMutation, updateMutation],
    );

    const handleSubmit = useCallback(() => doSubmit(false), [doSubmit]);

    // ── Save & Continue — save unit type first so Photos can work ──
    const handleSaveForUpload = useCallback(() => {
        const values = form.getFieldsValue(true);
        if (!values.primary_category || !values.property_type) {
            message.error(
                "Please fill in at least Category and Property Type before saving.",
            );
            return;
        }
        modal.confirm({
            title: "Save unit type to continue?",
            content: "Your unit type will be saved so you can upload photos.",
            okText: "Save & Continue",
            cancelText: "Cancel",
            onOk: () => doSubmit(true),
        });
    }, [form, modal, doSubmit]);

    const handleClose = useCallback(() => {
        form.resetFields();
        setLocalUnitType(null);
        saveForUploadRef.current = false;
        onClose();
    }, [form, onClose]);

    // ---- Render ----

    const errorMessage =
        createMutation.error?.message || updateMutation.error?.message;

    return (
        <Modal
            title={isEffectivelyEditing ? "Edit Unit Type" : "Add Unit Type"}
            open={open}
            onOk={handleSubmit}
            onCancel={handleClose}
            okText={isEffectivelyEditing ? "Update" : "Create"}
            okButtonProps={{ loading: isLoading }}
            cancelButtonProps={{ disabled: isLoading }}
            width={1040}
            destroyOnClose
        >
            {errorMessage && (
                <Alert
                    message={errorMessage}
                    type="error"
                    showIcon
                    className="mb-4"
                />
            )}

            <Form
                form={form}
                layout="vertical"
                requiredMark="optional"
                className="max-h-[65vh] overflow-y-auto pr-2"
            >
                {/* ================================================
                    SECTION 1 — Basic Info
                   ================================================ */}
                <Divider orientation="left" orientationMargin={0}>
                    <Text strong>Basic Information</Text>
                </Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="primary_category"
                            label="Category"
                            rules={[{ required: true, message: "Required" }]}
                        >
                            <Radio.Group>
                                {PRIMARY_CATEGORY_OPTIONS.map((o) => (
                                    <Radio.Button key={o.value} value={o.value}>
                                        {o.label}
                                    </Radio.Button>
                                ))}
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="property_type"
                            label="Property Type"
                            rules={[{ required: true, message: "Required" }]}
                        >
                            <Select
                                placeholder="Select type"
                                allowClear
                                options={propertyTypeOptions.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {primaryCategory === "residential" && (
                    <Form.Item name="unit_style" label="Unit Style(s)">
                        <Select
                            mode="multiple"
                            placeholder="Select styles (optional)"
                            allowClear
                            options={UNIT_STYLE_OPTIONS.map((o) => ({
                                value: o.value,
                                label: o.label,
                            }))}
                        />
                    </Form.Item>
                )}

                {/* <Form.Item name="reference_code" label="Reference Code">
                    <Input
                        placeholder="Auto-generated if left empty"
                        maxLength={50}
                    />
                </Form.Item> */}

                {/* ================================================
                    SECTION 2 — Specifications
                   ================================================ */}
                <Divider orientation="left" orientationMargin={0}>
                    <Text strong>Specifications</Text>
                </Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="view_types" label="View Types">
                            <Select
                                mode="multiple"
                                placeholder="Select views"
                                allowClear
                                options={VIEW_TYPE_OPTIONS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="furniture_status"
                            label="Furniture Status"
                        >
                            <Select
                                placeholder="Select status"
                                allowClear
                                options={FURNITURE_STATUS_OPTIONS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="starting_price" label="Starting Price">
                            <InputNumber<number>
                                style={{ width: "100%" }}
                                min={0}
                                precision={2}
                                formatter={(value) =>
                                    `${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ",",
                                    )
                                }
                                parser={(value) =>
                                    value ? Number(value.replace(/,/g, "")) : 0
                                }
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={4}>
                        <Form.Item name="currency" label="Currency">
                            <Select
                                options={CURRENCY_OPTIONS.map((o) => ({
                                    value: o.value,
                                    label: o.symbol,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="bedrooms" label="Bedrooms">
                            <Select
                                placeholder="Select"
                                allowClear
                                options={BEDROOM_OPTIONS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="bathrooms" label="Bathrooms">
                            <Select
                                placeholder="Select"
                                allowClear
                                options={BATHROOM_OPTIONS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="floor" label="Floor">
                            <Select
                                placeholder="Select floor"
                                allowClear
                                options={FLOOR_OPTIONS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="floors_in_building"
                            label="Floors in Building"
                        >
                            <Select
                                placeholder="Select"
                                allowClear
                                options={FLOORS_IN_BUILDING_OPTIONS.map(
                                    (o) => ({
                                        value: o.value,
                                        label: o.label,
                                    }),
                                )}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={6}>
                        <Form.Item
                            name="total_area_sqm"
                            label="Total Area (m²)"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                precision={2}
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item
                            name="living_area_sqm"
                            label="Living Area (m²)"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                precision={2}
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item
                            name="terrace_balcony_sqm"
                            label="Terrace/Balcony (m²)"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                precision={2}
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={6}>
                        <Form.Item name="plot_size_sqm" label="Plot Size (m²)">
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                precision={2}
                                placeholder="0.00"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="completion_date"
                            label="Expected Completion"
                        >
                            <DatePicker
                                style={{ width: "100%" }}
                                format="YYYY-MM-DD"
                                placeholder="Select date"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {/* ================================================
                    SECTION 3 — Features
                   ================================================ */}
                <Divider orientation="left" orientationMargin={0}>
                    <Text strong>Outside Features</Text>
                </Divider>

                <Form.Item name="outside_features" noStyle>
                    <Checkbox.Group className="w-full">
                        <Row gutter={[8, 4]}>
                            {OUTSIDE_FEATURE_OPTIONS.map((o) => (
                                <Col span={8} key={o.value}>
                                    <Checkbox value={o.value}>
                                        {o.label}
                                    </Checkbox>
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>

                <Divider orientation="left" orientationMargin={0}>
                    <Text strong>Inside Features</Text>
                </Divider>

                <Form.Item name="inside_features" noStyle>
                    <Checkbox.Group className="w-full">
                        <Row gutter={[8, 4]}>
                            {INSIDE_FEATURE_OPTIONS.map((o) => (
                                <Col span={8} key={o.value}>
                                    <Checkbox value={o.value}>
                                        {o.label}
                                    </Checkbox>
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>

                {/* ================================================
                    SECTION 4 — Legal Info
                   ================================================ */}
                <Divider orientation="left" orientationMargin={0}>
                    <Text strong>Legal Information</Text>
                </Divider>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="military_base_distance_km"
                            label="Distance to Military Base (km)"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                min={0}
                                precision={2}
                                placeholder="e.g. 5.50"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="has_restrictions"
                            label="Has Restrictions?"
                            valuePropName="checked"
                        >
                            <Switch
                                checkedChildren="Yes"
                                unCheckedChildren="No"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {hasRestrictions && (
                    <Form.Item
                        name="restriction_notes"
                        label="Restriction Notes"
                    >
                        <TextArea
                            rows={2}
                            placeholder="Describe the restrictions..."
                        />
                    </Form.Item>
                )}

                {/* ================================================
                    SECTION 5 — Description
                   ================================================ */}
                <Divider orientation="left" orientationMargin={0}>
                    <Text strong>Description</Text>
                </Divider>

                <Form.Item name="description">
                    <TextArea
                        rows={4}
                        placeholder="Detailed description of this unit type..."
                        showCount
                        maxLength={5000}
                    />
                </Form.Item>

                {/* ================================================
                    SECTION 6 — Photos
                   ================================================ */}
                <Divider orientation="left" orientationMargin={0}>
                    <Text strong>
                        <PictureOutlined className="mr-1" />
                        Photos
                    </Text>
                </Divider>

                <UnitTypePhotosSection
                    projectId={projectId}
                    unitTypeId={effectiveUnitTypeId}
                    onSaveForUpload={
                        !effectiveUnitTypeId ? handleSaveForUpload : undefined
                    }
                />
            </Form>
        </Modal>
    );
};

export default UnitTypeFormModal;
