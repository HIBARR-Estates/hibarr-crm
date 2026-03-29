import React, { useState, useEffect, useRef, useCallback } from "react";
import dayjs from "dayjs";
import {
    Form,
    Button,
    Alert,
    Space,
    Input,
    App,
    Divider,
    Typography,
    Select,
} from "antd";
import {
    SaveOutlined,
    CheckOutlined,
    HomeOutlined,
    DollarOutlined,
    AppstoreOutlined,
    EnvironmentOutlined,
    TagsOutlined,
    StarOutlined,
    SafetyCertificateOutlined,
    FolderOpenOutlined,
    PictureOutlined,
    FileTextOutlined,
    UserOutlined,
    LockOutlined,
    BuildOutlined,
    ToolOutlined,
    CheckSquareOutlined,
    ThunderboltOutlined,
    BlockOutlined,
} from "@ant-design/icons";
import { Property, PropertyEnumValues, PrimaryCategory } from "@/Types";
import type { DeveloperProjectUnitType } from "@/Types/developerProject";
import { AppPermission } from "@/Types/permission";
import { usePage } from "@inertiajs/react";
import { useGenerateDescription } from "@/lib/ai";
import usePropertyPermissions from "@/Hooks/usePropertyPermissions";
import { CATEGORY_SECTIONS } from "./fieldConfig";
import {
    CategorySelector,
    FormSection,
    CoreDetailsSection,
    PricingSection,
    SpecificationsSection,
    LocationSection,
    ClassificationSection,
    FeaturesSection,
    LegalFinancialSection,
    DocumentsSection,
    PhotosSection,
    DescriptionMediaSection,
    OwnerInfoSection,
    InternalInfoSection,
    ConstructionProjectInfoSection,
    ConstructionProjectDetailsSection,
    ConstructionProjectPricingSection,
    ConstructionProjectFacilitiesSection,
    ConstructionProjectPhotosSection,
    ConstructionProjectLocationSection,
} from "./sections";
import UnitTypesSection from "@/Features/DeveloperProjects/UnitTypesSection";
import { useApiQuery } from "@/lib/api/client/useApiQuery";

export interface PropertyCategoryFormProps {
    data?: Partial<Property>;
    setProperty?: (property: Property | undefined) => void;
    onSubmit: (values: any) => void;
    onCancel: () => void;
    loading?: boolean;
    errors?: string[];
    setErrors?: (errors: string[]) => void;
    onErrorsClear?: () => void;
    visible?: boolean;
}

export default function PropertyCategoryForm({
    data,
    onSubmit,
    onCancel,
    loading = false,
    errors = [],
    setErrors,
    onErrorsClear,
    setProperty,
    visible,
}: PropertyCategoryFormProps) {
    const [form] = Form.useForm();
    const contentRef = useRef<HTMLDivElement>(null);
    const saveForUploadRef = useRef(false);
    const { modal, message } = App.useApp();
    const {
        isEnabled: aiEnabled,
        isGenerating,
        error: aiError,
        insufficientMessage,
        generate,
    } = useGenerateDescription();

    const { props } = usePage<any>();
    const enumValues = props.enumValues as PropertyEnumValues | undefined;

    const isEditMode = !!data?.id;

    // Permission checks
    const propertyPermissions = usePropertyPermissions(
        isEditMode ? (data as Property) : null,
    );
    const userPermissions = props.auth?.permissions as
        | AppPermission
        | undefined;
    const isSalesManagerUser = !!(
        userPermissions?.edit_product === "all" ||
        userPermissions?.edit_product === 4
    );

    // Section-level permission gating:
    // - Edit mode: use property-specific permissions (SM or creator)
    // - Create mode: only SM can see restricted sections
    const canSeeOwnerInfo = isEditMode
        ? propertyPermissions.canViewOwnerInfo
        : isSalesManagerUser;
    const canSeeDocuments = isEditMode
        ? propertyPermissions.canViewDocuments
        : isSalesManagerUser;
    const canSeeInternalInfo = isEditMode
        ? propertyPermissions.canViewInternalInfo
        : isSalesManagerUser;
    const isSalesManager = isEditMode
        ? propertyPermissions.isSalesManager
        : isSalesManagerUser;

    // ── Fetch unit types for construction project (edit mode) ──
    const constructionProjectId = data?.id;
    const unitTypesQueryPath = constructionProjectId
        ? route("developer-projects.unit-types.index", {
              projectId: constructionProjectId,
          })
        : "";
    const { data: unitTypesData, refetch: refetchUnitTypes } = useApiQuery<{
        status: string;
        unit_types: DeveloperProjectUnitType[];
    }>({
        path: unitTypesQueryPath,
        options: { enabled: visible === true && !!constructionProjectId },
    });
    const cpUnitTypes = unitTypesData?.unit_types ?? [];

    // ── "Save & Continue" for construction projects ──
    const handleConstructionProjectSaveForUpload = useCallback(() => {
        const values = form.getFieldsValue(true);
        if (!values.name || !values.developer_id) {
            message.error(
                "Please fill in at least Construction Company and Project Name before saving.",
            );
            return;
        }
        modal.confirm({
            title: "Save project to continue?",
            content:
                "Your project will be saved so you can upload photos and manage unit types.",
            okText: "Save & Continue",
            cancelText: "Cancel",
            onOk: () => {
                const submitValues = transformValues(values);
                onSubmit({
                    ...submitValues,
                    _isDraft: true,
                    _isConstructionProject: true,
                    _saveForUpload: true,
                });
            },
        });
    }, [form, modal, onSubmit]);

    // ── Unit-type → property field mapping ──
    // Maps DeveloperProjectUnitType fields to property form field names.
    const UNIT_TYPE_FIELD_MAP: Record<string, string | [string, string]> = {
        property_type: "property_type",
        unit_style: "unit_style",
        bedrooms: "bedrooms",
        bathrooms: "bathrooms",
        floor: "floor_number",
        floors_in_building: "floors_in_building",
        total_area_sqm: "gross_sqm",
        living_area_sqm: "living_area_sqm",
        terrace_balcony_sqm: "balcony_net_sqm",
        plot_size_sqm: "land_size",
        furniture_status: "furniture_status",
        view_types: "view_types",
        completion_date: "completion_date",
        outside_features: "exterior_features",
        inside_features: "interior_features",
        has_restrictions: ["legal_info", "has_restrictions"],
        restriction_notes: ["legal_info", "restriction_notes"],
        description: "description",
    };

    // Locked fields state — tracks which property form fields are disabled
    // because they were auto-filled from a unit type selection.
    const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());

    // Handle unit type selection from CoreDetailsSection
    const handleUnitTypeSelect = useCallback(
        (unitType: DeveloperProjectUnitType | null) => {
            if (!unitType) {
                // Clear all prefilled values and unlock
                const fieldsToClear: Record<string, any> = {};
                for (const [utKey, formKey] of Object.entries(
                    UNIT_TYPE_FIELD_MAP,
                )) {
                    if (Array.isArray(formKey)) {
                        // Nested field: e.g. ["legal_info", "has_restrictions"]
                        const current = form.getFieldValue(formKey[0]) || {};
                        fieldsToClear[formKey[0]] = {
                            ...current,
                            [formKey[1]]: undefined,
                        };
                    } else {
                        fieldsToClear[formKey] = undefined;
                    }
                }
                form.setFieldsValue(fieldsToClear);
                setLockedFields(new Set());
                return;
            }

            // Map unit type values → property form fields
            const newValues: Record<string, any> = {};
            const locked = new Set<string>();

            for (const [utKey, formKey] of Object.entries(
                UNIT_TYPE_FIELD_MAP,
            )) {
                const value = (unitType as any)[utKey];
                if (value === null || value === undefined) continue;

                if (Array.isArray(formKey)) {
                    // Nested field
                    const parentKey = formKey[0];
                    const childKey = formKey[1];
                    const current = form.getFieldValue(parentKey) || {};
                    newValues[parentKey] = {
                        ...current,
                        ...(newValues[parentKey] || {}),
                        [childKey]: value,
                    };
                    locked.add(`${parentKey}.${childKey}`);
                } else {
                    newValues[formKey] = value;
                    locked.add(formKey);
                }
            }

            form.setFieldsValue(newValues);
            setLockedFields(locked);
        },
        [form],
    );

    // Hydrate lockedFields in edit mode when the form already has a unit type
    useEffect(() => {
        if (
            data?.developer_project_unit_type_id &&
            visible &&
            lockedFields.size === 0
        ) {
            // Build the locked set from whichever mapped fields have a
            // non-null value on the existing property and match the mapping.
            const locked = new Set<string>();
            for (const [_utKey, formKey] of Object.entries(
                UNIT_TYPE_FIELD_MAP,
            )) {
                if (Array.isArray(formKey)) {
                    locked.add(`${formKey[0]}.${formKey[1]}`);
                } else {
                    locked.add(formKey);
                }
            }
            setLockedFields(locked);
        }
    }, [data, visible]);

    // Track category from form
    const primaryCategory = Form.useWatch("primary_category", form) as
        | PrimaryCategory
        | undefined;

    // Reset form when modal closes
    useEffect(() => {
        if (!visible) {
            form.resetFields();
        }
    }, [visible, form]);

    // Initialize form with existing property data
    useEffect(() => {
        if (data && visible) {
            const initialValues: Record<string, any> = { ...data };

            // Derive _selected_developer_id from existing developer project
            if (initialValues.developer_project_id) {
                const projects = (props?.developerProjects || []) as any[];
                const project = projects.find(
                    (p: any) => p.id === initialValues.developer_project_id,
                );
                if (project?.developer_id) {
                    initialValues._selected_developer_id = project.developer_id;
                }
            }

            // Convert date strings to dayjs objects for DatePicker fields
            if (
                initialValues.completion_date &&
                typeof initialValues.completion_date === "string"
            ) {
                initialValues.completion_date = dayjs(
                    initialValues.completion_date,
                );
            }

            form.setFieldsValue(initialValues);
        }
    }, [data, visible, form]);

    // Determine section visibility
    const sections = primaryCategory
        ? CATEGORY_SECTIONS[primaryCategory]
        : null;

    // Handle category change
    const handleCategoryChange = (category: PrimaryCategory) => {
        form.setFieldValue("primary_category", category);
    };

    // Convenience flag — is the selected category a construction project?
    const isConstructionProject = primaryCategory === "construction_project";

    // ─── Single currency picker state ───
    const CURRENCY_OPTIONS = [
        { value: "GBP", label: "£ GBP" },
        { value: "TRY", label: "₺ TRY" },
        { value: "USD", label: "$ USD" },
        { value: "EUR", label: "€ EUR" },
    ];
    const [selectedCurrency, setSelectedCurrency] = useState<string>(
        (props as any).default_currency_code || "GBP",
    );
    // Auto-set GBP when switching to land category
    useEffect(() => {
        if (primaryCategory === "land") {
            setSelectedCurrency("GBP");
        }
    }, [primaryCategory]);

    // Handle save draft — only requires property_type and sale_type (or name for construction projects)
    const handleSave = async () => {
        const values = form.getFieldsValue(true);

        if (isConstructionProject) {
            if (!values.name || !values.developer_id) {
                message.error(
                    "Please fill in at least Construction Company and Project Name before saving",
                );
                return;
            }
            const submitValues = transformValues(values);
            onSubmit({
                ...submitValues,
                _isDraft: true,
                _isConstructionProject: true,
            });
            return;
        }

        if (!values.property_type || !values.sale_type) {
            message.error(
                "Please fill in at least Property Type and Sale Type before saving",
            );
            return;
        }

        const submitValues = transformValues(values);
        onSubmit({ ...submitValues, _isDraft: true });
    };

    // Handle "Save & Continue" for photo uploads (create mode)
    const handleSaveForUpload = useCallback(() => {
        const values = form.getFieldsValue(true);

        if (!values.property_type || !values.sale_type) {
            message.error(
                "Please fill in at least Property Type and Sale Type before saving",
            );
            return;
        }

        modal.confirm({
            title: "Save property to upload photos?",
            content:
                "Your current form data will be saved as a draft so you can start uploading photos.",
            okText: "Save & Continue",
            cancelText: "Cancel",
            onOk: () => {
                saveForUploadRef.current = true;
                const submitValues = transformValues(values);
                onSubmit({
                    ...submitValues,
                    _isDraft: true,
                    _saveForUpload: true,
                });
            },
        });
    }, [form, onSubmit]);

    // Handle full submit
    const handleFinish = async () => {
        try {
            await form.validateFields();
        } catch (errorInfo: any) {
            const errCount = errorInfo?.errorFields?.length || 0;
            message.warning(
                `Please fix ${errCount} error${errCount !== 1 ? "s" : ""} before submitting`,
            );
            // Scroll to first error
            form.scrollToField(errorInfo?.errorFields?.[0]?.name, {
                behavior: "smooth",
                block: "center",
            });
            return;
        }

        const values = form.getFieldsValue(true);
        const submitValues = transformValues(values);
        onSubmit({
            ...submitValues,
            ...(isConstructionProject ? { _isConstructionProject: true } : {}),
        });
    };

    // Transform form values for API submission
    const transformValues = (values: any) => {
        const {
            _isDraft,
            _selected_developer_id,
            _isConstructionProject,
            ...cleanData
        } = values;

        if (primaryCategory === "construction_project") {
            // Construction project payload (DeveloperProject)
            return {
                ...cleanData,
                primary_categories: cleanData.primary_categories || [],
                unit_types: cleanData.unit_types || [],
                facilities: cleanData.facilities || [],
                distances: cleanData.distances || {},
                payment_plan: cleanData.payment_plan || null,
            };
        }

        // Standard property payload
        return {
            ...cleanData,
            interior_features: cleanData.interior_features || [],
            within_site: cleanData.within_site || false,
            city: Array.isArray(cleanData.city)
                ? cleanData.city[0] || null
                : cleanData.city || null,
            exterior_features: cleanData.exterior_features || [],
            location_features: cleanData.location_features || [],
            photos: cleanData.photos || [],
            add_ons: cleanData.add_ons || [],
        };
    };

    // Handle cancel
    const handleCancel = () => {
        setErrors?.([]);
        setProperty?.(undefined);
        form.resetFields();
        onCancel();
    };

    return (
        <div className="property-category-form">
            {/* Global errors */}
            {errors.length > 0 && (
                <Alert
                    message="Error"
                    description={
                        <ul className="mb-0 pl-4">
                            {errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    }
                    type="error"
                    showIcon
                    closable
                    onClose={onErrorsClear}
                    className="mb-4"
                />
            )}

            <Form
                form={form}
                layout="vertical"
                size="middle"
                initialValues={data || {}}
            >
                {/* Scrollable content area */}
                <div
                    ref={contentRef}
                    className="overflow-y-auto overflow-x-hidden max-h-[65vh] space-y-4 pb-4 pr-1"
                >
                    {/* ======================== */}
                    {/* Category Selector — always visible */}
                    {/* ======================== */}
                    <FormSection
                        title="Property Category"
                        icon={<HomeOutlined />}
                        defaultOpen={true}
                        description="Select the category — this determines which fields are shown"
                    >
                        <Form.Item
                            name="primary_category"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a category",
                                },
                            ]}
                            noStyle
                        >
                            <CategorySelector
                                form={form}
                                value={primaryCategory || undefined}
                                onChange={handleCategoryChange}
                            />
                        </Form.Item>
                    </FormSection>

                    {/* Only show remaining sections once category is selected */}
                    {primaryCategory && sections && (
                        <>
                            {/* ================================================================ */}
                            {/* Construction Project Sections — entirely different form */}
                            {/* ================================================================ */}
                            {isConstructionProject && (
                                <>
                                    {/* Project Info — company & project name */}
                                    <FormSection
                                        title="Project Info"
                                        icon={<BuildOutlined />}
                                        description="Construction company and project name"
                                    >
                                        <ConstructionProjectInfoSection
                                            form={form}
                                        />
                                    </FormSection>

                                    {/* Project Details — classification & specs */}
                                    <FormSection
                                        title="Project Details"
                                        icon={<AppstoreOutlined />}
                                        description="Construction status, unit types, and specifications"
                                    >
                                        <ConstructionProjectDetailsSection
                                            form={form}
                                        />
                                    </FormSection>

                                    {/* Pricing & Payment Plan */}
                                    <FormSection
                                        title="Pricing & Payment"
                                        icon={<DollarOutlined />}
                                        description="Starting price, payment plan, and availability"
                                    >
                                        <ConstructionProjectPricingSection
                                            form={form}
                                        />
                                    </FormSection>

                                    {/* Location */}
                                    <FormSection
                                        title="Location"
                                        icon={<EnvironmentOutlined />}
                                        description="Project location and distances to amenities"
                                        defaultOpen={false}
                                    >
                                        <ConstructionProjectLocationSection
                                            form={form}
                                            enumValues={enumValues}
                                            project={
                                                isConstructionProject
                                                    ? (data as any)
                                                    : null
                                            }
                                        />
                                    </FormSection>

                                    {/* Facilities */}
                                    <FormSection
                                        title="Project Facilities"
                                        icon={<CheckSquareOutlined />}
                                        description="Amenities and facilities available in the project"
                                        defaultOpen={false}
                                    >
                                        <ConstructionProjectFacilitiesSection
                                            form={form}
                                        />
                                    </FormSection>

                                    {/* Photos */}
                                    <FormSection
                                        title="Project Photos"
                                        icon={<PictureOutlined />}
                                        description="Site plans and exterior photos"
                                        defaultOpen={false}
                                    >
                                        <ConstructionProjectPhotosSection
                                            form={form}
                                            projectId={data?.id}
                                            onSaveForUpload={
                                                !data?.id
                                                    ? handleConstructionProjectSaveForUpload
                                                    : undefined
                                            }
                                        />
                                    </FormSection>

                                    {/* Description */}
                                    <FormSection
                                        title="Description"
                                        icon={<FileTextOutlined />}
                                        description="Project description and notes"
                                        defaultOpen={false}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="ant-form-item-label">
                                                <span>Project Description</span>
                                            </label>
                                            {aiEnabled && (
                                                <Button
                                                    size="small"
                                                    icon={
                                                        <ThunderboltOutlined />
                                                    }
                                                    onClick={async () => {
                                                        const formData =
                                                            form.getFieldsValue(
                                                                true,
                                                            );
                                                        const existing =
                                                            formData.description;

                                                        const doGenerate =
                                                            async () => {
                                                                const desc =
                                                                    await generate(
                                                                        formData,
                                                                    );
                                                                if (desc) {
                                                                    form.setFieldValue(
                                                                        "description",
                                                                        desc,
                                                                    );
                                                                }
                                                            };

                                                        if (existing?.trim()) {
                                                            modal.confirm({
                                                                title: "Replace existing description?",
                                                                content:
                                                                    "This will replace your current description with an AI-generated one.",
                                                                okText: "Replace",
                                                                cancelText:
                                                                    "Cancel",
                                                                onOk: doGenerate,
                                                            });
                                                        } else {
                                                            await doGenerate();
                                                        }
                                                    }}
                                                    loading={isGenerating}
                                                    type="default"
                                                >
                                                    {isGenerating
                                                        ? "Generating\u2026"
                                                        : "Generate with AI"}
                                                </Button>
                                            )}
                                        </div>
                                        <Form.Item name="description" noStyle>
                                            <Input.TextArea
                                                rows={4}
                                                placeholder="Describe the construction project..."
                                                showCount
                                                maxLength={5000}
                                                disabled={isGenerating}
                                            />
                                        </Form.Item>
                                        {insufficientMessage && (
                                            <div className="mt-2">
                                                <Alert
                                                    message={
                                                        insufficientMessage
                                                    }
                                                    type="info"
                                                    showIcon
                                                    closable
                                                />
                                            </div>
                                        )}
                                        {aiError && (
                                            <div className="mt-2">
                                                <Alert
                                                    message={aiError}
                                                    type="error"
                                                    showIcon
                                                    closable
                                                />
                                            </div>
                                        )}
                                    </FormSection>

                                    {/* Unit Types */}
                                    <Divider />
                                    <FormSection
                                        title="Unit Types"
                                        icon={<BlockOutlined />}
                                        description="Manage unit types and their specifications"
                                        defaultOpen={true}
                                    >
                                        {data?.id ? (
                                            <UnitTypesSection
                                                projectId={data.id}
                                                unitTypes={cpUnitTypes}
                                                onRefresh={() => {
                                                    refetchUnitTypes();
                                                }}
                                            />
                                        ) : (
                                            <div className="text-center py-8">
                                                <BlockOutlined
                                                    style={{
                                                        fontSize: 48,
                                                        color: "#d9d9d9",
                                                    }}
                                                    className="mb-4"
                                                />
                                                <Typography.Title
                                                    level={5}
                                                    type="secondary"
                                                >
                                                    Save the project to manage
                                                    unit types
                                                </Typography.Title>
                                                <Typography.Text
                                                    type="secondary"
                                                    className="block mb-4"
                                                >
                                                    Unit types can be added once
                                                    the project has been saved.
                                                </Typography.Text>
                                                <Button
                                                    type="primary"
                                                    icon={<SaveOutlined />}
                                                    onClick={
                                                        handleConstructionProjectSaveForUpload
                                                    }
                                                >
                                                    Save & Continue
                                                </Button>
                                            </div>
                                        )}
                                    </FormSection>
                                </>
                            )}

                            {/* ================================================================ */}
                            {/* Standard Property Sections (non-construction) */}
                            {/* ================================================================ */}
                            {!isConstructionProject && (
                                <>
                                    {/* Core Details */}
                                    {sections.coreDetails && (
                                        <FormSection
                                            title="Core Details"
                                            icon={<AppstoreOutlined />}
                                            description="Property type, status, and sale type"
                                        >
                                            <CoreDetailsSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                enumValues={enumValues}
                                                isSalesManager={isSalesManager}
                                                onUnitTypeSelect={
                                                    handleUnitTypeSelect
                                                }
                                                lockedFields={lockedFields}
                                            />
                                        </FormSection>
                                    )}

                                    {/* Specifications — before pricing for land (need area to calculate price/m²) */}
                                    {primaryCategory === "land" &&
                                        sections.specifications && (
                                            <FormSection
                                                title="Land Area"
                                                icon={<AppstoreOutlined />}
                                                description="Plot size in m² and dönüm"
                                            >
                                                <SpecificationsSection
                                                    form={form}
                                                    primaryCategory={
                                                        primaryCategory
                                                    }
                                                    enumValues={enumValues}
                                                    lockedFields={lockedFields}
                                                />
                                            </FormSection>
                                        )}

                                    {/* Pricing */}
                                    {sections.pricing && (
                                        <FormSection
                                            title="Pricing"
                                            icon={<DollarOutlined />}
                                            description="Price, price per m², and swap options"
                                        >
                                            {/* Currency selector — applies to all price fields */}
                                            <div className="mb-4">
                                                <Typography.Text
                                                    type="secondary"
                                                    className="text-xs block mb-1"
                                                >
                                                    Default currency for all
                                                    price fields
                                                </Typography.Text>
                                                <Select
                                                    value={selectedCurrency}
                                                    onChange={
                                                        setSelectedCurrency
                                                    }
                                                    options={CURRENCY_OPTIONS}
                                                    style={{ width: 160 }}
                                                />
                                            </div>
                                            <PricingSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                selectedCurrency={
                                                    selectedCurrency
                                                }
                                            />
                                        </FormSection>
                                    )}

                                    {/* Specifications — after pricing for non-land */}
                                    {primaryCategory !== "land" &&
                                        sections.specifications && (
                                            <FormSection
                                                title="Specifications"
                                                icon={<AppstoreOutlined />}
                                                description="Rooms, areas, and building details"
                                                defaultOpen={false}
                                            >
                                                <SpecificationsSection
                                                    form={form}
                                                    primaryCategory={
                                                        primaryCategory
                                                    }
                                                    enumValues={enumValues}
                                                    lockedFields={lockedFields}
                                                />
                                            </FormSection>
                                        )}

                                    {/* Location */}
                                    {sections.location && (
                                        <FormSection
                                            title="Location"
                                            icon={<EnvironmentOutlined />}
                                            description="City, area, address, and coordinates"
                                            defaultOpen={false}
                                        >
                                            <LocationSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                enumValues={enumValues}
                                            />
                                        </FormSection>
                                    )}

                                    {/* Classification */}
                                    {sections.classification && (
                                        <FormSection
                                            title="Classification"
                                            icon={<TagsOutlined />}
                                            description="Construction status, views, and occupancy"
                                            defaultOpen={false}
                                        >
                                            <ClassificationSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                enumValues={enumValues}
                                                lockedFields={lockedFields}
                                            />
                                        </FormSection>
                                    )}

                                    {/* Features — hidden for land */}
                                    {sections.features && (
                                        <FormSection
                                            title="Features"
                                            icon={<StarOutlined />}
                                            description="Interior, exterior, location features and add-ons"
                                            defaultOpen={false}
                                        >
                                            <FeaturesSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                enumValues={enumValues}
                                                lockedFields={lockedFields}
                                            />
                                        </FormSection>
                                    )}

                                    {/* Legal & Financial */}
                                    {sections.legalFinancial && (
                                        <FormSection
                                            title="Legal & Financial"
                                            icon={<SafetyCertificateOutlined />}
                                            description="Title deed, rental terms, and financial details"
                                            defaultOpen={false}
                                        >
                                            <LegalFinancialSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                enumValues={enumValues}
                                                lockedFields={lockedFields}
                                                selectedCurrency={
                                                    selectedCurrency
                                                }
                                            />
                                        </FormSection>
                                    )}

                                    {/* Documents (land only) */}
                                    {canSeeDocuments && sections.documents && (
                                        <FormSection
                                            title="Documents Checklist"
                                            icon={<FolderOpenOutlined />}
                                            description="Upload required documents for this land listing"
                                            defaultOpen={false}
                                        >
                                            <DocumentsSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                            />
                                        </FormSection>
                                    )}

                                    {/* Photos */}
                                    {sections.photos && (
                                        <FormSection
                                            title="Photos"
                                            icon={<PictureOutlined />}
                                            description="Upload and tag property photos"
                                            defaultOpen={false}
                                        >
                                            <PhotosSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                propertyId={data?.id}
                                                existingAssets={
                                                    (data as any)?.assets
                                                }
                                                onSaveForUpload={
                                                    handleSaveForUpload
                                                }
                                            />
                                        </FormSection>
                                    )}

                                    {/* Description & Media */}
                                    {sections.descriptionMedia && (
                                        <FormSection
                                            title="Description & Media"
                                            icon={<FileTextOutlined />}
                                            description="Property description, video, and virtual tour links"
                                            defaultOpen={false}
                                        >
                                            <DescriptionMediaSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                lockedFields={lockedFields}
                                            />
                                        </FormSection>
                                    )}

                                    {/* Owner Info */}
                                    {canSeeOwnerInfo && sections.ownerInfo && (
                                        <FormSection
                                            title="Owner Information"
                                            icon={<UserOutlined />}
                                            description="Owner contact and personal details"
                                            defaultOpen={false}
                                        >
                                            <OwnerInfoSection
                                                form={form}
                                                primaryCategory={
                                                    primaryCategory
                                                }
                                                isSalesManager={isSalesManager}
                                            />
                                        </FormSection>
                                    )}

                                    {/* Internal Info */}
                                    {canSeeInternalInfo &&
                                        sections.internalInfo && (
                                            <FormSection
                                                title="Internal Info"
                                                icon={<LockOutlined />}
                                                description="Internal pricing, commission, and private notes"
                                                defaultOpen={false}
                                            >
                                                <InternalInfoSection
                                                    form={form}
                                                    primaryCategory={
                                                        primaryCategory
                                                    }
                                                    selectedCurrency={
                                                        selectedCurrency
                                                    }
                                                />
                                            </FormSection>
                                        )}
                                </>
                            )}
                        </>
                    )}
                </div>

                {/* Sticky bottom actions */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
                    <Button onClick={handleCancel} disabled={loading}>
                        Cancel
                    </Button>

                    <Space>
                        {/* Save Draft */}
                        <Button
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            loading={loading}
                        >
                            {isEditMode ? "Save" : "Save Draft"}
                        </Button>

                        {/* Submit */}
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={handleFinish}
                            loading={loading}
                            disabled={!primaryCategory}
                        >
                            {isEditMode
                                ? isConstructionProject
                                    ? "Update Project"
                                    : "Update Property"
                                : isConstructionProject
                                  ? "Create Project"
                                  : "Create Property"}
                        </Button>
                    </Space>
                </div>
            </Form>
        </div>
    );
}
