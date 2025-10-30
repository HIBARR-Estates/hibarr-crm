import React, { useState, useEffect } from "react";
import { router, useForm, usePage } from "@inertiajs/react";
import { Drawer, message, Form } from "antd";
import { Deal, CreateDealFormData } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import DealForm from "./DealForm";

interface SaveDealModalProps extends Omit<IModalProps, "onClose"> {
    deal?: Deal;
    setDeal?: (deal: Deal | undefined) => void;
    onClose: () => void;
}

const constructCustomFieldsData = (
    customFields: any[],
    custom_fields_data: Record<string, any> = {}
) => {
    const data: Record<string, any> = {};
    customFields.forEach((field) => {
        data[`${field?.name}_${field?.id}`] =
            custom_fields_data?.[`field_${field?.id}`];
    });
    return data;
};

const SaveDealModal: React.FC<SaveDealModalProps> = ({
    deal,
    onClose,
    open,
    setDeal,
}) => {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { props } = usePage<any>();

    const { customFields } = props;

    // Determine if we're editing or creating
    const isEditing = !!deal;
    const submitText = isEditing ? "Update Deal" : "Create Deal";

    // Initialize form data
    const initialData: CreateDealFormData = {
        name: deal?.name || "",
        lead_contact: deal?.contact.id || undefined,
        pipeline: deal?.lead_pipeline_id || undefined,
        stage_id: deal?.pipeline_stage_id || undefined,
        value: deal?.value || 0,
        close_date: deal?.close_date || "",
        category_id: deal?.category_id || undefined,
        agent_id: deal?.agent_id || undefined,
        product_id: deal?.products?.map((p) => p.id) || [],
        deal_watcher: deal?.deal_watchers?.map((w) => w.id) || [],
        strategy_accepted: !!deal?.strategy_accepted,
        downpayment_confirmed: !!deal?.downpayment_confirmed,
        custom_fields_data:
            constructCustomFieldsData(customFields, deal?.custom_fields_data) ||
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

    // Update form data when deal changes
    useEffect(() => {
        if (deal) {
            const updatedData: CreateDealFormData = {
                name: deal.name || "",
                lead_contact: deal?.contact.id || undefined,
                pipeline: deal.lead_pipeline_id || undefined,
                stage_id: deal.pipeline_stage_id || undefined,
                value: deal.value || 0,
                close_date: deal.close_date || "",
                category_id: deal.category_id || undefined,
                agent_id: deal.agent_id || undefined,
                product_id: deal.products?.map((p) => p.id) || [],
                deal_watcher: deal.deal_watchers?.map((w) => w.id) || [],
                strategy_accepted: !!deal.strategy_accepted,
                downpayment_confirmed: !!deal.downpayment_confirmed,
                custom_fields_data:
                    constructCustomFieldsData(
                        customFields,
                        deal?.custom_fields_data
                    ) || {},
            };

            // Update the form data
            // Set all fields at once to avoid deep-instantiation TypeScript errors
            setData(updatedData);
        }
    }, [deal]);

    useEffect(() => {
        if (pushing) {
            if (isEditing) {
                submit("put", route("deals.update", deal!.id), {
                    onSuccess: (res) => {
                        setPushing(false);
                        const successMessage = "Deal updated successfully";
                        message.success(successMessage);
                        onClose();
                        // Refresh the deals list
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
                submit("post", route("deals.store"), {
                    onSuccess: (page) => {
                        setPushing(false);
                        const successMessage = "Deal created successfully";
                        message.success(successMessage);
                        reset();
                        onClose();
                        // Refresh the deals list
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

    console.log(deal, "deal in SaveDealModal");

    return (
        <Drawer
            title={isEditing ? "Edit Deal" : "Add Deal"}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
        >
            <DealForm
                data={deal ? data : undefined}
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
                setDeal={setDeal}
                loading={processing || pushing}
            />
        </Drawer>
    );
};

export default SaveDealModal;
