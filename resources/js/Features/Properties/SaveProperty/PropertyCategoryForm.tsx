import React, { useState, useEffect, useRef, useCallback } from "react";
import { Form, Button, Alert, Space, Modal, message } from "antd";
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
} from "@ant-design/icons";
import { Property, PropertyEnumValues, PrimaryCategory } from "@/Types";
import { AppPermission } from "@/Types/permission";
import { usePage } from "@inertiajs/react";
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
} from "./sections";

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
            const initialValues = { ...data };

            // Map elevator from interior_features to virtual _has_elevator field
            if (
                Array.isArray(initialValues.interior_features) &&
                initialValues.interior_features.includes("Elevator")
            ) {
                (initialValues as any)._has_elevator = true;
            }

            // Derive _selected_developer_id from existing developer project
            if (initialValues.developer_project_id) {
                const projects = (props?.developerProjects || []) as any[];
                const project = projects.find(
                    (p: any) => p.id === initialValues.developer_project_id,
                );
                if (project?.developer_id) {
                    (initialValues as any)._selected_developer_id =
                        project.developer_id;
                }
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

    // Handle save draft — only requires property_type and sale_type
    const handleSave = async () => {
        const values = form.getFieldsValue(true);

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

        Modal.confirm({
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
        onSubmit(submitValues);
    };

    // Transform form values for API submission
    const transformValues = (values: any) => {
        const {
            _has_elevator,
            _isDraft,
            _selected_developer_id,
            ...cleanData
        } = values;

        // Merge elevator into interior_features
        let interiorFeatures = cleanData.interior_features || [];
        if (_has_elevator && !interiorFeatures.includes("Elevator")) {
            interiorFeatures = [...interiorFeatures, "Elevator"];
        } else if (!_has_elevator) {
            interiorFeatures = interiorFeatures.filter(
                (f: string) => f !== "Elevator",
            );
        }

        return {
            ...cleanData,
            interior_features: interiorFeatures,
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
                            {/* Core Details */}
                            {sections.coreDetails && (
                                <FormSection
                                    title="Core Details"
                                    icon={<AppstoreOutlined />}
                                    description="Property type, status, and sale type"
                                >
                                    <CoreDetailsSection
                                        form={form}
                                        primaryCategory={primaryCategory}
                                        enumValues={enumValues}
                                        isSalesManager={isSalesManager}
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
                                            primaryCategory={primaryCategory}
                                            enumValues={enumValues}
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
                                    <PricingSection
                                        form={form}
                                        primaryCategory={primaryCategory}
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
                                            primaryCategory={primaryCategory}
                                            enumValues={enumValues}
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
                                        primaryCategory={primaryCategory}
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
                                        primaryCategory={primaryCategory}
                                        enumValues={enumValues}
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
                                        primaryCategory={primaryCategory}
                                        enumValues={enumValues}
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
                                        primaryCategory={primaryCategory}
                                        enumValues={enumValues}
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
                                        primaryCategory={primaryCategory}
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
                                        primaryCategory={primaryCategory}
                                        propertyId={data?.id}
                                        existingAssets={(data as any)?.assets}
                                        onSaveForUpload={handleSaveForUpload}
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
                                        primaryCategory={primaryCategory}
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
                                        primaryCategory={primaryCategory}
                                        isSalesManager={isSalesManager}
                                    />
                                </FormSection>
                            )}

                            {/* Internal Info */}
                            {canSeeInternalInfo && sections.internalInfo && (
                                <FormSection
                                    title="Internal Info"
                                    icon={<LockOutlined />}
                                    description="Internal pricing, commission, and private notes"
                                    defaultOpen={false}
                                >
                                    <InternalInfoSection
                                        form={form}
                                        primaryCategory={primaryCategory}
                                    />
                                </FormSection>
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
                            {isEditMode ? "Update Property" : "Create Property"}
                        </Button>
                    </Space>
                </div>
            </Form>
        </div>
    );
}
