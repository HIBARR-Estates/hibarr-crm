import React, { useState, useEffect } from "react";
import { router, useForm } from "@inertiajs/react";
import { Typography, message, Form } from "antd";
import {
    Lead,
    CreateLeadFormData,
    LeadCategory,
    LeadSource,
    User,
} from "@/Types/api/leads";

const { Title } = Typography;

interface CreateLeadProps {
    visible?: boolean;
    onClose?: () => void;
    onSuccess?: () => void;
    lead?: Lead; // Optional lead for editing
    setLead?: (lead: Lead | undefined) => void;
    title?: string; // Optional title
    isPage?: boolean; // True when displayed as a full page instead of drawer
    employees: User[];
    categories: LeadCategory[];
    sources: LeadSource[];
    countries: Array<{ iso: string; nicename: string; iso3: string }>;
    salutations: Array<{ value: string; label: string }>;
}

export default function CreateLead({
    visible,
    onClose,
    onSuccess,
    lead,
    setLead,
    title = "Create New Lead",
    isPage = false,
    employees,
    categories,
    sources,
    countries,
    salutations,
}: CreateLeadProps) {
    const [form] = Form.useForm();
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Determine if we're editing or creating
    const isEditing = !!lead;
    const submitText = isEditing ? "Update Lead" : "Create Lead";

    // Initialize form data
    const initialData: CreateLeadFormData = {
        salutation: lead?.salutation || "",
        client_name: lead?.client_name || "",
        client_email: lead?.client_email || "",
        mobile: lead?.mobile || "",
        company_name: lead?.company_name || "",
        website: lead?.website || "",
        address: lead?.address || "",
        cell: lead?.cell || "",
        office: lead?.office || "",
        city: lead?.city || "",
        state: lead?.state || "",
        country: lead?.country || "",
        postal_code: lead?.postal_code || "",
        note: lead?.note || "",
        source_id: lead?.source_id || undefined,
        category_id: lead?.category_id || undefined,
        lead_owner: lead?.lead_owner?.id || undefined,
        added_by: lead?.added_by?.id || undefined,
        create_deal: false,
        create_client: false,
    };

    // Use Inertia's useForm hook for better CSRF and error handling
    const {
        data,
        setData,
        submit,
        processing,
        errors: formErrors,
        reset,
    } = useForm(initialData);

    const [pushing, setPushing] = useState(false);

    useEffect(() => {
        if (pushing) {
            // Handle the pushing state
            if (isEditing) {
                submit("put", route("lead-contact.update", lead!.id), {
                    onSuccess: (res) => {
                        setPushing(false);
                        const successMessage = "Lead updated successfully";
                        message.success(successMessage);

                        if (onSuccess) {
                            onSuccess();
                        } else if (!isPage) {
                            onClose?.();
                        } else {
                            router.visit(route("lead-contact.index"));
                        }
                    },
                    onError: (errors) => {
                        setPushing(false);
                        const errorMessages = Object.values(errors).flat();
                        setErrors(errors as Record<string, string>);
                        message.error("Please check the form for errors");
                    },
                });
            } else {
                submit("post", route("lead-contact.store"), {
                    onSuccess: (page) => {
                        setPushing(false);
                        const successMessage = "Lead created successfully";
                        message.success(successMessage);
                        reset();

                        if (onSuccess) {
                            onSuccess();
                        } else if (!isPage) {
                            onClose?.();
                        } else {
                            router.visit(route("lead-contact.index"));
                        }
                    },
                    onError: (errors) => {
                        setPushing(false);
                        const errorMessages = Object.values(errors).flat();
                        setErrors(errors as Record<string, string>);
                        message.error("Please check the form for errors");
                    },
                });
            }
        }
    }, [pushing]);

    const handleSubmit = () => {
        // Clear previous errors
        setErrors({});
        // Trigger the submission
        setPushing(true);
    };

    const handleCancel = () => {
        reset();
        setErrors({});
        if (onClose) {
            onClose();
        } else {
            router.visit(route("lead-contact.index"));
        }
    };

    const handleSetData = (key: keyof CreateLeadFormData, value: any) => {
        setData(key, value);
        // Clear error for this field when user starts typing
        if (errors[key]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[key];
                return newErrors;
            });
        }
    };

    return (
        <div className="space-y-6">
            {isPage && (
                <div className="mb-6">
                    <Title level={2}>{title}</Title>
                </div>
            )}

            <h2 style={{ marginBottom: 24 }}>Create New Deal</h2>
        </div>
    );
}
