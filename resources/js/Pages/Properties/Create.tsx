import React, { useState, useEffect } from "react";
import { router, useForm } from "@inertiajs/react";
import { Typography, message } from "antd";
import { Property } from "@/Types";
import PropertyForm from "@/Modules/Properties/SaveProperty/PropertyForm";

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
}: CreatePropertyProps) {
    const [errors, setErrors] = useState<string[]>([]);

    // Determine if we're editing or creating
    const isEditing = !!property;
    const submitText = isEditing ? "Update Property" : "Create Property";

    // Use Inertia's useForm hook for better CSRF and error handling
    const {
        data,
        setData,
        submit,
        processing,
        errors: formErrors,
        reset,
    } = useForm({});

    const [pushing, setPushing] = useState(false);

    useEffect(() => {
        if (pushing) {
            // Handle the pushing state
            if (isEditing) {
                submit("put", route("properties.update", property.id), {
                    onSuccess: (res) => {
                        // TODO: Update the returned property response to property to enable othe tab fields to be editable
                        // setProperty?.(res);
                        setPushing(false);

                        const successMessage = "Property updated successfully";
                        message.success(successMessage);

                        if (onSuccess) {
                            onSuccess();
                        } else if (!isPage) {
                            onClose?.();
                        } else {
                            router.visit(route("properties.index"));
                        }
                    },
                    onError: (errors) => {
                        setPushing(false);

                        const errorMessages = Object.values(errors).flat();
                        setErrors(errorMessages as string[]);
                        message.error("Please check the form for errors");
                    },
                });
            } else {
                submit("post", route("properties.store"), {
                    onSuccess: (page) => {
                        // TODO: Update the returned property response to property to enable othe tab fields to be editable
                        // setProperty?.(res);
                        console.log(page, "post page ....");

                        setPushing(false);
                        const successMessage = "Property created successfully";
                        message.success(successMessage);
                        reset();

                        if (onSuccess) {
                            onSuccess();
                        } else if (!isPage) {
                            onClose?.();
                        } else {
                            router.visit(route("properties.index"));
                        }
                    },
                    onError: (errors) => {
                        setPushing(false);
                        const errorMessages = Object.values(errors).flat();
                        setErrors(errorMessages as string[]);
                        message.error("Please check the form for errors");
                    },
                });
            }
        }
    }, [pushing]);

    const handleSubmit = (formData: any) => {
        // Clear previous errors
        setErrors([]);

        // Transform the values to match the API expectations
        const submitData = {
            ...formData,
            within_site: formData.within_site || false,
            // Handle array fields
            exterior_features: formData.exterior_features || [],
            interior_features: formData.interior_features || [],
            location_features: formData.location_features || [],
            photos: formData.photos || [],
            add_ons: formData.add_ons || [],
        };

        // Update the form data
        setData(submitData);
        setPushing(true);
    };

    const handleCancel = () => {
        if (isPage) {
            router.visit(route("properties.index"));
        } else {
            onClose?.();
        }
        setErrors([]);
    };

    const handleErrorsClear = () => {
        setErrors([]);
    };

    // Combine form errors with manual errors
    const allErrors = [
        ...errors,
        ...Object.values(formErrors).flat().map(String),
    ];

    const formContent = (
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
                <div className="mb-6">
                    <Title level={2}>{title}</Title>
                </div>
                {formContent}
            </div>
        );
    }

    return <>{formContent}</>;
}
