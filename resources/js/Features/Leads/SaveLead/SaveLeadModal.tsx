import React, { useState, useEffect } from "react";
import { router, useForm, usePage } from "@inertiajs/react";
import { Drawer, message, Form } from "antd";
import { Lead, CreateLeadFormData } from "@/Types/api/leads";
import { IModalProps } from "@/Types/common";
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
    const [form] = Form.useForm();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { props } = usePage<any>();

    const { customFields = [] } = props;
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
        custom_fields_data:
            constructCustomFieldsData(customFields, lead?.custom_fields_data) ||
            {},
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

    // Update form data when lead changes
    useEffect(() => {
        if (lead) {
            const updatedData: CreateLeadFormData = {
                salutation: lead.salutation || "",
                client_name: lead.client_name || "",
                client_email: lead.client_email || "",
                mobile: lead.mobile || "",
                company_name: lead.company_name || "",
                website: lead.website || "",
                address: lead.address || "",
                cell: lead.cell || "",
                office: lead.office || "",
                city: lead.city || "",
                state: lead.state || "",
                country: lead.country || "",
                postal_code: lead.postal_code || "",
                note: lead.note || "",
                source_id: lead.source_id || undefined,
                category_id: lead.category_id || undefined,
                lead_owner: lead.lead_owner?.id || undefined,
                added_by: lead.added_by?.id || undefined,
                create_deal: false,
                create_client: false,
                custom_fields_data:
                    constructCustomFieldsData(
                        customFields,
                        lead?.custom_fields_data
                    ) || {},
            };

            // Update the form data
            // Set all fields at once to avoid deep-instantiation TypeScript errors
            setData(updatedData);
        }
    }, [lead]);

    useEffect(() => {
        if (pushing) {
            if (isEditing) {
                submit("put", route("lead-contact.update", lead!.id), {
                    onSuccess: (res) => {
                        setPushing(false);
                        const successMessage = "Lead updated successfully";
                        message.success(successMessage);
                        onClose();
                        // Refresh the leads list
                        router.reload();
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
                        onClose();
                        // Refresh the leads list
                        router.reload();
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

    const handleSubmit = (formData: any) => {
        // Clear previous errors
        setErrors({});
        // Transform the values to match the API expectations
        const submitData = {
            ...formData,
        };

        // Update the form data
        setData(submitData);
        setPushing(true);
    };

    const handleCancel = () => {
        reset();
        setErrors({});
        onClose();
    };
    const handleErrorsClear = () => {
        setErrors({});
    };

    // Combine form errors with manual errors
    const allErrors = [
        ...Object.values(errors).flat().map(String),
        ...Object.values(formErrors).flat().map(String),
    ];

    console.log(lead, "lead in SaveLeadModal");

    return (
        <Drawer
            title={
                isEditing ? "Edit Lead Contact Info" : "Add Lead Contact Info"
            }
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
        >
            <LeadForm
                data={lead ? data : undefined}
                visible={open}
                onCancel={handleCancel}
                onSubmit={handleSubmit}
                submitText={submitText}
                cancelText={"Cancel"}
                errors={allErrors}
                setErrors={(errors) =>
                    errors.forEach((error, field) =>
                        setErrors((prev) => ({ ...prev, [field]: error }))
                    )
                }
                onErrorsClear={handleErrorsClear}
                setLead={setLead}
                loading={processing || pushing}
            />
        </Drawer>
    );
};

export default SaveLeadModal;
