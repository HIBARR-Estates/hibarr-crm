import React, { useState, useEffect, useCallback, useRef } from "react";
import { router } from "@inertiajs/react";
import { Typography, message, Segmented } from "antd";
import { Property } from "@/Types";
import { DeveloperProject } from "@/Types/developerProject";
import PropertyForm from "@/Features/Properties/SaveProperty/PropertyForm";
import PropertyWizardForm from "@/Features/Properties/SaveProperty/PropertyWizardForm";
import PropertyCategoryForm from "@/Features/Properties/SaveProperty/PropertyCategoryForm";
import {
    UnorderedListOutlined,
    NumberOutlined,
    AppstoreOutlined,
} from "@ant-design/icons";
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
    const [projectId, setProjectId] = useState<number | undefined>(undefined);
    // Default: use category form for all (new default), keep wizard and tabs as alternatives
    const isEditing = !!property?.id;
    const defaultFormMode = "category";
    const [formMode, setFormMode] = useState<"wizard" | "tabs" | "category">(
        useWizard === undefined
            ? defaultFormMode
            : useWizard
              ? "wizard"
              : "tabs",
    );

    // Ref to track "save for upload" flow (don't navigate away after create)
    const saveForUploadRef = useRef(false);

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
            // If this was a "save for upload" flow, stay on the form
            // and transition to edit mode with the created property
            if (saveForUploadRef.current) {
                saveForUploadRef.current = false;
                const createdProperty = (res.data as any)?.property || res.data;
                if (createdProperty) {
                    setProperty?.(createdProperty);
                }
                message.success("Property saved! You can now upload photos.");
                return;
            }

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

    // Create construction project mutation
    const createProjectMutation = useApiMutate<
        any,
        DeveloperProject,
        ApiSuccessResponse<DeveloperProject>
    >(route("developer-projects.store"), "POST", (res) => {
        if (res?.status === "success") {
            // If this was a "save for upload" flow, stay on the form
            // and transition to edit mode with the created project
            if (saveForUploadRef.current) {
                saveForUploadRef.current = false;
                const createdProject = (res.data as any)?.project || res.data;
                if (createdProject) {
                    setProperty?.(createdProject as any);
                }
                message.success(
                    "Project saved! You can now upload photos and manage unit types.",
                );
                return;
            }

            message.success("Construction project created!");
            if (onSuccess) {
                onSuccess();
            } else if (!isPage) {
                onClose?.();
            } else {
                router.visit(route("developer-projects.index"));
            }
        }
    });

    // Update construction project mutation
    const updateProjectMutation = useApiMutate<
        any,
        DeveloperProject,
        ApiSuccessResponse<DeveloperProject> & {
            developer_project?: DeveloperProject;
        }
    >(
        isEditing ? route("developer-projects.update", property?.id) : "",
        "PUT",
        (res) => {
            if (res?.status === "success") {
                message.success("Construction project updated!");
                const updatedProject =
                    res.data || (res as any).developer_project;
                if (updatedProject) {
                    setProperty?.(updatedProject as any);
                }

                if (onSuccess) {
                    onSuccess();
                } else if (!isPage) {
                    onClose?.();
                } else {
                    router.visit(route("developer-projects.index"));
                }
            }
        },
    );

    // Combined loading state
    const processing =
        createMutation.isPending ||
        updateMutation.isPending ||
        createProjectMutation.isPending ||
        updateProjectMutation.isPending;

    const handleSubmit = useCallback(
        (formData: any) => {
            // Clear previous errors
            setErrors([]);
            setFormErrors({});

            // Check if this is a construction project submission
            const {
                _isDraft,
                _saveForUpload,
                _isConstructionProject,
                ...cleanData
            } = formData;

            // Track save-for-upload intent so the success callback stays on form
            if (_saveForUpload) {
                saveForUploadRef.current = true;
            }

            const onError = (error: any) => {
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
            };

            // ── Construction Project path ──
            if (_isConstructionProject) {
                const projectData = {
                    ...cleanData,
                    // Ensure arrays default to []
                    primary_categories: cleanData.primary_categories || [],
                    unit_types: cleanData.unit_types || [],
                    facilities: cleanData.facilities || [],
                    distances: cleanData.distances || {},
                    payment_plan: cleanData.payment_plan || {},
                };

                if (isEditing) {
                    updateProjectMutation.mutate(projectData, {
                        onError,
                        onSuccess: (res) => {
                            setProjectId?.(res.data?.id);
                        },
                    });
                } else {
                    createProjectMutation.mutate(projectData, {
                        onError,

                        onSuccess: (res) => {
                            setProjectId?.(res.data?.id);
                        },
                    });
                }
                return;
            }

            // ── Standard Property path ──

            const submitData = {
                ...cleanData,
                within_site: cleanData.within_site || false,
                // Handle city - convert array to string, send null if empty so backend nullable rule applies
                city: Array.isArray(cleanData.city)
                    ? cleanData.city[0] || null
                    : cleanData.city || null,
                // Handle array fields
                exterior_features: cleanData.exterior_features || [],
                interior_features: cleanData.interior_features || [],
                location_features: cleanData.location_features || [],
                photos: cleanData.photos || [],
                add_ons: cleanData.add_ons || [],
            };

            if (isEditing) {
                updateMutation.mutate(submitData, {
                    onError,
                    onSuccess: (res) => {
                        setProperty?.(res.data);
                    },
                });
            } else {
                createMutation.mutate(submitData, {
                    onError,
                    onSuccess: (res) => {
                        setProperty?.(res.data);
                    },
                });
            }
        },
        [
            isEditing,
            createMutation,
            updateMutation,
            createProjectMutation,
            updateProjectMutation,
        ],
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
            value: "category",
            label: "Form",
            icon: <AppstoreOutlined />,
        },
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
        formMode === "category" ? (
            <PropertyCategoryForm
                setProperty={setProperty}
                data={projectId ? { id: projectId } : property}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                loading={processing}
                errors={allErrors}
                setErrors={setErrors}
                onErrorsClear={handleErrorsClear}
                visible={visible}
            />
        ) : formMode === "wizard" ? (
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
                            setFormMode(value as "wizard" | "tabs" | "category")
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
            {/* <div className="mb-4 flex justify-end">
                {isEditing ? (
                    <Segmented
                        options={formModeOptions}
                        value={formMode}
                        onChange={(value) =>
                            setFormMode(value as "wizard" | "tabs" | "category")
                        }
                        size="small"
                    />
                ) : null}
            </div> */}
            {formContent}
        </div>
    );
}
