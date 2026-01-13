import React, { useState, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";
import { Drawer, message } from "antd";
import { Lead, CreateLeadFormData } from "@/Types/api/leads";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import LeadForm from "./LeadForm";

interface SaveLeadModalProps extends Omit<IModalProps, "onClose"> {
    lead?: Lead;
    setLead?: (lead: Lead | undefined) => void;
    onClose: () => void;
}

const constructCustomFieldsData = (
    customFields: any[] = [],
    custom_fields_data: Record<string, any> = {}
) => {
    const data: Record<string, any> = {};
    customFields?.forEach((field) => {
        data[`${field?.name}_${field?.id}`] =
            custom_fields_data?.[`field_${field?.id}`];
    });
    return data;
};

const SaveLeadModal: React.FC<SaveLeadModalProps> = ({
    lead,
    onClose,
    open,
    setLead,
}) => {
    const [errors, setErrors] = useState<string[]>([]);
    const [formData, setFormData] = useState<CreateLeadFormData | null>(null);
    const { props } = usePage<any>();
    console.log(lead, "why lead ....");

    const customFields = props.leadCustomFields || props.customFields || [];
    // Determine if we're editing or creating
    const isEditing = !!lead;
    const submitText = isEditing ? "Update Contact" : "Create Contact";

    // Initialize form data
    const getInitialData = (): CreateLeadFormData => ({
        salutation:
            lead?.salutation_value ??
            (lead?.salutation as any)?.value ??
            lead?.salutation ??
            "",
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
        gender:
            lead?.gender_value ??
            (lead?.gender as any)?.value ??
            lead?.gender ??
            "",
        custom_fields_data:
            constructCustomFieldsData(customFields, lead?.custom_fields_data) ||
            {},
    });

    // Setup API mutation
    const { mutate: createLead, status: createStatus } = useApiMutate<
        CreateLeadFormData,
        Lead,
        ApiResponse<Lead>
    >(route("lead-contact.store"), "POST");

    const { mutate: updateLead, status: updateStatus } = useApiMutate<
        CreateLeadFormData,
        Lead,
        ApiResponse<Lead>
    >(isEditing ? `/account/lead-contact/${lead?.id}` : "", "PUT");

    // Update form data when lead or modal opens
    useEffect(() => {
        if (open) {
            const initialData = getInitialData();
            setFormData(initialData);
        }
    }, [lead, open, customFields]);

    const handleSubmit = (data: CreateLeadFormData) => {
        // Clear previous errors
        setErrors([]);

        const mutation = isEditing ? updateLead : createLead;

        mutation(data, {
            onSuccess: () => {
                setErrors([]);
                handleCancel();
                router.reload();
            },
            onError: (errorResponse) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors((prev) => [
                    ...prev,
                    ...Object.values(responseErrors).flat(),
                ]);
            },
        });
    };

    const handleCancel = () => {
        setFormData(null);
        setErrors([]);
        onClose();
    };

    const handleErrorsClear = () => {
        setErrors([]);
    };

    const isLoading =
        getLoadingStatus({ status: createStatus }) ||
        getLoadingStatus({ status: updateStatus });

    return (
        <Drawer
            title={isEditing ? "Edit Lead" : "Add Lead"}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
        >
            <LeadForm
                data={formData || undefined}
                visible={open}
                onCancel={handleCancel}
                onSubmit={handleSubmit}
                submitText={submitText}
                cancelText={"Cancel"}
                errors={errors}
                setErrors={(newErrors) => {
                    if (Array.isArray(newErrors)) {
                        setErrors(newErrors);
                    }
                }}
                onErrorsClear={handleErrorsClear}
                setLead={setLead}
                loading={isLoading}
                isEditing={isEditing}
            />
        </Drawer>
    );
};

export default SaveLeadModal;
