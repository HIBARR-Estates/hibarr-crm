import React, { useState, useRef, useEffect, useMemo } from "react";
import { Form, Button, Alert, message, Space, Card, Tag, Tooltip } from "antd";
import {
    ArrowLeftOutlined,
    ArrowRightOutlined,
    CheckOutlined,
    SaveOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import { Property, PropertyEnumValues } from "@/Types";
import { usePage } from "@inertiajs/react";

// Import step components
import {
    BasicInfoStep,
    ClassificationStep,
    LocationStep,
    PropertyDetailsStep,
    FeaturesStep,
    LegalFinancialStep,
    OwnerInfoStep,
} from "./Steps";
import ModernSteps from "@/Features/Deals/DealInformationGathering/ModernSteps";

export interface PropertyWizardFormProps {
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

// Define the steps for the wizard
const WIZARD_STEPS = [
    {
        key: "basic",
        title: "Basic Info",
        description: "Title, type, price",
        required: true,
    },
    {
        key: "classification",
        title: "Classification",
        description: "Category, style, views",
        required: false,
    },
    {
        key: "location",
        title: "Location",
        description: "Address & project",
        required: true,
    },
    {
        key: "details",
        title: "Details",
        description: "Rooms, size, amenities",
        required: false,
    },
    {
        key: "features",
        title: "Features",
        description: "Interior & exterior",
        required: false,
    },
    {
        key: "legal",
        title: "Legal & Financial",
        description: "Deed, commission",
        required: false,
    },
    {
        key: "owner",
        title: "Owner Info",
        description: "Contact details",
        required: false,
    },
];

export default function PropertyWizardForm({
    data,
    onSubmit,
    onCancel,
    loading = false,
    errors = [],
    setErrors,
    onErrorsClear,
    setProperty,
    visible,
}: PropertyWizardFormProps) {
    const [form] = Form.useForm();
    const [currentStep, setCurrentStep] = useState(0);
    const [formValues, setFormValues] = useState<Partial<Property>>({});
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(
        new Set(),
    );
    const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});
    const contentRef = useRef<HTMLDivElement>(null);

    const { props } = usePage<any>();
    const enumValues = props.enumValues as PropertyEnumValues | undefined;

    const isEditMode = !!data?.id;

    // Reset form when modal closes
    useEffect(() => {
        if (!visible) {
            setCurrentStep(0);
            setFormValues({});
            setCompletedSteps(new Set());
            setStepErrors({});
            form.resetFields();
        }
    }, [visible, form]);

    // Initialize form with existing data
    useEffect(() => {
        if (data && visible) {
            const initialValues = { ...data };
            setFormValues(initialValues);
            form.setFieldsValue(initialValues);
            // Mark all steps as complete for edit mode
            if (isEditMode) {
                setCompletedSteps(new Set(WIZARD_STEPS.map((_, i) => i)));
            }
        }
    }, [data, visible, form, isEditMode]);

    // Auto-scroll to top when step changes
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [currentStep]);

    // Validate current step fields
    const validateCurrentStep = async (): Promise<boolean> => {
        const currentStepKey = WIZARD_STEPS[currentStep].key;
        const fieldsToValidate = getStepFields(currentStepKey);

        try {
            await form.validateFields(fieldsToValidate);
            // Clear step errors on success
            setStepErrors((prev) => {
                const updated = { ...prev };
                delete updated[currentStep];
                return updated;
            });
            return true;
        } catch (errorInfo: any) {
            const errors =
                errorInfo.errorFields?.map((field: any) =>
                    field.errors.join(", "),
                ) || [];
            setStepErrors((prev) => ({
                ...prev,
                [currentStep]: errors,
            }));
            return false;
        }
    };

    // Get fields that belong to a specific step
    const getStepFields = (stepKey: string): string[] => {
        switch (stepKey) {
            case "basic":
                return [
                    "primary_category",
                    "title",
                    "description",
                    "property_type",
                    "sale_type",
                    "unit_style",
                    "bedrooms",
                    "living_room",
                    "price",
                    "status",
                    "developer_project_id",
                    "project_location_id",
                    "city",
                    "area",
                ];
            case "classification":
                return ["construction_status", "view_types", "occupancy_type"];
            case "location":
                return ["address", "latitude", "longitude"];
            case "details":
                return [
                    "rooms",
                    "bedrooms",
                    "bathrooms",
                    "living_room",
                    "total_floors",
                    "floor",
                    "net_sqm",
                    "gross_sqm",
                    "land_size",
                    "balcony_count",
                    "balcony_net_sqm",
                    "building_age",
                    "furniture_status",
                    "heating_type",
                    "delivery_date",
                ];
            case "features":
                return [
                    "interior_features",
                    "exterior_features",
                    "location_features",
                    "add_ons",
                ];
            case "legal":
                return [
                    "title_deed_type",
                    "title_deed_stage",
                    "minimal_rental_period",
                    "rent_payment_interval",
                    "legal_info",
                    "financial_info",
                ];
            case "owner":
                return ["owner_info"];
            default:
                return [];
        }
    };

    // Handle next step
    const handleNext = async () => {
        const isValid = await validateCurrentStep();
        if (!isValid) {
            message.warning("Please fix the errors before continuing");
            return;
        }

        // Save current step values
        const currentValues = form.getFieldsValue();
        setFormValues((prev) => ({ ...prev, ...currentValues }));

        // Mark step as completed
        setCompletedSteps((prev) => new Set([...prev, currentStep]));

        // Move to next step
        if (currentStep < WIZARD_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    // Handle previous step
    const handlePrev = () => {
        // Save current values before going back
        const currentValues = form.getFieldsValue();
        setFormValues((prev) => ({ ...prev, ...currentValues }));
        setCurrentStep(currentStep - 1);
    };

    // Handle step click navigation
    const handleStepClick = (stepIndex: number) => {
        // Allow clicking on completed steps or current step + 1
        if (
            completedSteps.has(stepIndex) ||
            stepIndex === currentStep ||
            (stepIndex === currentStep + 1 && completedSteps.has(currentStep))
        ) {
            // Save current values before navigating
            const currentValues = form.getFieldsValue();
            setFormValues((prev) => ({ ...prev, ...currentValues }));
            setCurrentStep(stepIndex);
        }
    };

    // Handle save (submit partial data)
    const handleSave = async () => {
        // Validate required fields only
        const currentValues = form.getFieldsValue();
        const finalValues = { ...formValues, ...currentValues };

        // Check required fields for basic step
        if (
            !finalValues.title ||
            !finalValues.property_type ||
            !finalValues.sale_type
        ) {
            message.error(
                "Please complete at least the Basic Info step with title, property type, and sale type",
            );
            setCurrentStep(0);
            return;
        }

        onSubmit(finalValues);
    };

    // Handle final submit
    const handleFinish = async () => {
        // Validate current step first
        const isValid = await validateCurrentStep();
        if (!isValid) {
            message.warning("Please fix the errors before submitting");
            return;
        }

        // Merge all form values
        const currentValues = form.getFieldsValue();
        const finalValues = { ...formValues, ...currentValues };

        onSubmit(finalValues);
    };

    // Handle cancel
    const handleCancel = () => {
        setCurrentStep(0);
        setFormValues({});
        setCompletedSteps(new Set());
        setErrors?.([]);
        setProperty?.(undefined);
        form.resetFields();
        onCancel();
    };

    // Calculate disabled steps
    const disabledSteps = useMemo(() => {
        const disabled: number[] = [];
        for (let i = 0; i < WIZARD_STEPS.length; i++) {
            // A step is disabled if:
            // 1. It's beyond current step + 1 AND
            // 2. The previous step is not completed
            if (i > currentStep + 1 && !completedSteps.has(i - 1)) {
                disabled.push(i);
            }
        }
        return disabled;
    }, [currentStep, completedSteps]);

    // Render the current step content
    const renderStepContent = () => {
        const stepKey = WIZARD_STEPS[currentStep].key;
        const commonProps = {
            form,
            enumValues,
            data: formValues,
        };

        switch (stepKey) {
            case "basic":
                return <BasicInfoStep {...commonProps} />;
            case "classification":
                return <ClassificationStep {...commonProps} />;
            case "location":
                return <LocationStep {...commonProps} />;
            case "details":
                return <PropertyDetailsStep {...commonProps} />;
            case "features":
                return <FeaturesStep {...commonProps} />;
            case "legal":
                return <LegalFinancialStep {...commonProps} />;
            case "owner":
                return <OwnerInfoStep {...commonProps} />;
            default:
                return null;
        }
    };

    const isLastStep = currentStep === WIZARD_STEPS.length - 1;
    const isFirstStep = currentStep === 0;
    const currentStepInfo = WIZARD_STEPS[currentStep];
    const currentStepErrors = stepErrors[currentStep] || [];

    return (
        <div className="property-wizard-form">
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

            {/* Steps Navigation */}
            <ModernSteps
                current={currentStep}
                items={WIZARD_STEPS.map((step, index) => ({
                    title: step.title,
                    description: step.description,
                }))}
                onStepClick={handleStepClick}
                disabledSteps={disabledSteps}
            />

            {/* Step Content */}
            <div
                ref={contentRef}
                className="overflow-y-auto overflow-x-hidden max-h-[60vh] py-4"
            >
                {/* Step Header */}
                <div className="mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">
                                {currentStepInfo.title}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {currentStepInfo.description}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {currentStepInfo.required ? (
                                <Tag color="red">Required</Tag>
                            ) : (
                                <Tag color="blue">Optional</Tag>
                            )}
                            <Tooltip title="You can save and continue later">
                                <InfoCircleOutlined className="text-gray-400" />
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* Step Errors */}
                {currentStepErrors.length > 0 && (
                    <Alert
                        message="Please fix the following errors:"
                        description={
                            <ul className="mb-0 pl-4">
                                {currentStepErrors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        }
                        type="warning"
                        showIcon
                        className="mb-4"
                    />
                )}

                {/* Form Content */}
                <Form
                    form={form}
                    layout="vertical"
                    size="middle"
                    initialValues={formValues}
                >
                    {renderStepContent()}
                </Form>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
                <Button onClick={handleCancel} disabled={loading}>
                    Cancel
                </Button>

                <Space>
                    {/* Progress indicator */}
                    <span className="text-sm text-gray-500">
                        Step {currentStep + 1} of {WIZARD_STEPS.length}
                    </span>
                </Space>

                <Space>
                    {!isFirstStep && (
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={handlePrev}
                            disabled={loading}
                        >
                            Previous
                        </Button>
                    )}

                    {/* Save Draft button (always visible after first step) */}
                    {(currentStep > 0 || isEditMode) && (
                        <Button
                            icon={<SaveOutlined />}
                            onClick={handleSave}
                            loading={loading}
                        >
                            Save Draft
                        </Button>
                    )}

                    {isLastStep ? (
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={handleFinish}
                            loading={loading}
                        >
                            {isEditMode ? "Update Property" : "Create Property"}
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            icon={<ArrowRightOutlined />}
                            onClick={handleNext}
                            loading={loading}
                        >
                            Next
                        </Button>
                    )}
                </Space>
            </div>
        </div>
    );
}
