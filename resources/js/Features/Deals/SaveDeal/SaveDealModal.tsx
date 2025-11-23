import React, { useState, useEffect } from "react";
import { router, usePage } from "@inertiajs/react";
import { Drawer, message, Form } from "antd";
import { Deal, CreateDealFormData } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import DealForm from "./DealForm";

interface SaveDealModalProps extends Omit<IModalProps, "onClose"> {
    deal?: Deal;
    setDeal?: (deal: Deal | undefined) => void;
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

const SaveDealModal: React.FC<SaveDealModalProps> = ({
    deal,
    onClose,
    open,
    setDeal,
}) => {
    const [errors, setErrors] = useState<string[]>([]);
    const [formData, setFormData] = useState<CreateDealFormData | null>(null);
    const { props } = usePage<any>();

    const customFields = props.dealCustomFields || props.customFields || [];

    // Determine if we're editing or creating
    const isEditing = !!deal;
    const submitText = isEditing ? "Update Deal" : "Create Deal";

    // Initialize form data
    const getInitialData = (): CreateDealFormData => ({
        name: deal?.name || "",
        lead_contact: deal?.contact?.id || undefined,
        pipeline: deal?.lead_pipeline_id || undefined,
        stage_id: deal?.pipeline_stage_id || undefined,
        value: deal?.value || 0,
        close_date: deal?.close_date || "",
        category_id: deal?.category_id || undefined,
        agent_id: deal?.agent_id || undefined,
        product_id: deal?.products?.map((p) => p.id) || [],
        services: deal?.services?.map((s) => s.id) || [],
        deal_watcher: deal?.deal_watchers?.map((w) => w.id) || [],
        strategy_accepted: !!deal?.strategy_accepted,
        downpayment_confirmed: !!deal?.downpayment_confirmed,
        custom_fields_data:
            constructCustomFieldsData(customFields, deal?.custom_fields_data) ||
            {},
    });

    // Setup API mutation
    const { mutate: createDeal, status: createStatus } = useApiMutate<
        CreateDealFormData,
        Deal,
        ApiResponse<Deal>
    >(route("deals.store"), "POST");

    const { mutate: updateDeal, status: updateStatus } = useApiMutate<
        CreateDealFormData,
        Deal,
        ApiResponse<Deal>
    >(isEditing ? route("deals.update", deal!.id) : "", "PUT");

    // Update form data when deal or modal opens
    useEffect(() => {
        if (open) {
            const initialData = getInitialData();
            setFormData(initialData);
        }
    }, [deal, open, customFields]);

    const handleSubmit = (data: CreateDealFormData) => {
        // Clear previous errors
        setErrors([]);

        const mutation = isEditing ? updateDeal : createDeal;

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
            title={isEditing ? "Edit Deal" : "Add Deal"}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
        >
            <DealForm
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
                setDeal={setDeal}
                loading={isLoading}
            />
        </Drawer>
    );
};

export default SaveDealModal;
