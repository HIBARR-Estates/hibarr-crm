import React, { useState, useEffect, useCallback } from "react";
import { router } from "@inertiajs/react";
import { Typography, message, Segmented } from "antd";
import { Property } from "@/Types";
import PropertyForm from "@/Features/Properties/SaveProperty/PropertyForm";
import PropertyWizardForm from "@/Features/Properties/SaveProperty/PropertyWizardForm";
import { UnorderedListOutlined, NumberOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";

// Import the new PropertyForm component

const { Title } = Typography;

interface Product {
    id: number;
    name: string;
}

interface CreatePropertyProps {
    visible?: boolean;
    onClose?: () => void;
    onSuccess?: () => void;
    products?: Product[];
    property?: Property; // Optional property for editing
    setProperty?: (property: Property | undefined) => void;
    title?: string; // Optional title
    isPage?: boolean; // True when displayed as a full page instead of drawer
    useWizard?: boolean; // Use stepped wizard form (default: true for new, false for edit)
}

export default function CreateProperty({
    visible,
    onClose,
    onSuccess,
    products,
    property,
    setProperty,
    title = "Create New Property",
    isPage = false,
    useWizard,
}: CreatePropertyProps) {
    // Default: use wizard for new properties, tabs for editing (can be overridden)
    const isEditing = !!property?.id;
    const defaultFormMode = isEditing ? "tabs" : "wizard";
    const [formMode, setFormMode] = useState<"wizard" | "tabs">(
        useWizard === undefined
            ? defaultFormMode
            : useWizard
              ? "wizard"
              : "tabs",
    );

    // Submit button text based on mode
    const submitText = isEditing ? "Update Property" : "Create Property";

    // Form errors state
    const [errors, setErrors] = useState<string[]>([]);
    const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});

    // Create property mutation
    const createMutation = useApiMutate<
        any,
        Property,
        ApiSuccessResponse<Property>
    >(route("properties.store"), "POST", (res) => {
        if (res?.status === "success") {
            if (onSuccess) {
                onSuccess();
            } else if (!isPage) {
                onClose?.();
            } else {
                router.visit(route("properties.index"));
            }
        }
    });

    // Update property mutation
    const updateMutation = useApiMutate<
        any,
        Property,
        ApiSuccessResponse<Property> & { property?: Property }
    >(
        isEditing ? route("properties.update", property?.id) : "",
        "PUT",
        (res) => {
            if (res?.status === "success") {
                // Update the property state if setter is provided
                // Backend returns property at root level via Reply::successWithData
                const updatedProperty = res.data || (res as any).property;
                if (updatedProperty) {
                    setProperty?.(updatedProperty);
                }

                if (onSuccess) {
                    onSuccess();
                } else if (!isPage) {
                    onClose?.();
                } else {
                    router.visit(route("properties.index"));
                }
            }
        },
    );

    // Combined loading state
    const processing = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = useCallback(
        (formData: any) => {
            // Clear previous errors
            setErrors([]);
            setFormErrors({});

            // Transform the values to match the API expectations
            const submitData = {
                ...formData,
                within_site: formData.within_site || false,
                // Handle city - convert array to string if needed
                city: Array.isArray(formData.city)
                    ? formData.city[0] || ""
                    : formData.city || "",
                // Handle array fields
                exterior_features: formData.exterior_features || [],
                interior_features: formData.interior_features || [],
                location_features: formData.location_features || [],
                photos: formData.photos || [],
                add_ons: formData.add_ons || [],
            };

            if (isEditing) {
                updateMutation.mutate(submitData, {
                    onError: (error: any) => {
                        if (error?.errors) {
                            setFormErrors(error.errors);
                            const errorMessages = Object.values(
                                error.errors,
                            ).flat() as string[];
                            setErrors(errorMessages);
                        } else if (error?.message) {
                            setErrors([error.message]);
                        }
                        message.error("Please check the form for errors");
                    },
                });
            } else {
                createMutation.mutate(submitData, {
                    onError: (error: any) => {
                        if (error?.errors) {
                            setFormErrors(error.errors);
                            const errorMessages = Object.values(
                                error.errors,
                            ).flat() as string[];
                            setErrors(errorMessages);
                        } else if (error?.message) {
                            setErrors([error.message]);
                        }
                        message.error("Please check the form for errors");
                    },
                });
            }
        },
        [isEditing, createMutation, updateMutation],
    );

    const handleCancel = () => {
        if (isPage) {
            router.visit(route("properties.index"));
        } else {
            onClose?.();
        }
        setErrors([]);
        setFormErrors({});
    };

    const handleErrorsClear = () => {
        setErrors([]);
        setFormErrors({});
    };

    // All errors combined (errors array already contains flattened formErrors)
    const allErrors = errors;

    // Form mode toggle options
    const formModeOptions = [
        {
            value: "wizard",
            label: "Wizard",
            icon: <NumberOutlined />,
        },
        {
            value: "tabs",
            label: "Tabs",
            icon: <UnorderedListOutlined />,
        },
    ];

    const formContent =
        formMode === "wizard" ? (
            <PropertyWizardForm
                setProperty={setProperty}
                data={property}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                loading={processing}
                errors={allErrors}
                setErrors={setErrors}
                onErrorsClear={handleErrorsClear}
                visible={visible}
            />
        ) : (
            <PropertyForm
                setProperty={setProperty}
                data={property}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                loading={processing}
                errors={allErrors}
                setErrors={setErrors}
                onErrorsClear={handleErrorsClear}
                submitText={submitText}
                cancelText="Cancel"
                visible={visible}
            />
        );

    if (isPage) {
        return (
            <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                    <Title level={2}>{title}</Title>
                    <Segmented
                        options={formModeOptions}
                        value={formMode}
                        onChange={(value) =>
                            setFormMode(value as "wizard" | "tabs")
                        }
                    />
                </div>
                {formContent}
            </div>
        );
    }

    return (
        <div>
            {/* Form mode toggle for drawer mode */}
            <div className="mb-4 flex justify-end">
                {isEditing ? (
                    <Segmented
                        options={formModeOptions}
                        value={formMode}
                        onChange={(value) =>
                            setFormMode(value as "wizard" | "tabs")
                        }
                        size="small"
                    />
                ) : null}
            </div>
            {formContent}
        </div>
    );
}
