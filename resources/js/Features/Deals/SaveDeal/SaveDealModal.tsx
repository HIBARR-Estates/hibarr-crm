import React, { useState, useEffect, useMemo } from "react";
import { router, usePage } from "@inertiajs/react";
import { Drawer, message, Form, Alert } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { Deal, CreateDealFormData } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import DealForm from "./DealForm";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";

/**
 * M4/S3: edit-from-Index loads custom field *values* on open. Index rows no
 * longer include custom_fields_data — do not rely on the deal prop for values.
 */

interface SaveDealModalProps extends Omit<IModalProps, "onClose"> {
    deal?: Deal;
    lead_id?: number;
    setDeal?: (deal: Deal | undefined) => void;
    onClose: () => void;
    disableFields?: string[];
    /**
     * X2: Inertia partial-reload keys after a successful save
     * (e.g. ["deals"] from the Deals Index). Defaults to a full reload
     * for pages that haven't opted in.
     */
    reloadKeys?: string[];
}

const constructCustomFieldsData = (
    customFields: any[] = [],
    custom_fields_data: Record<string, any> = {},
) => {
    const data: Record<string, any> = {};
    customFields?.forEach((field) => {
        data[`${field?.name}_${field?.id}`] =
            custom_fields_data?.[`field_${field?.id}`];
    });
    return data;
};

const EMPTY_CUSTOM_FIELDS_DATA: Record<string, any> = {};

const SaveDealModal: React.FC<SaveDealModalProps> = ({
    deal,
    onClose,
    open,
    setDeal,
    lead_id,
    disableFields = [],
    reloadKeys,
}) => {
    const [errors, setErrors] = useState<string[]>([]);
    const [formData, setFormData] = useState<CreateDealFormData | null>(null);
    const { props } = usePage<any>();

    const formDataTypes = useMemo(
        () =>
            [
                "leads",
                "employees",
                "lead-pipelines",
                "lead-stages",
                "categories",
                "products",
                "lead-agents",
                "packages",
                "deal-custom-fields",
                "deal-custom-field-categories",
                "deal-pipeline-custom-field-category-map",
            ] as FormDataType[],
        [],
    );

    const { data: fetchedFormData } = useFormDataBatch(formDataTypes, {
        enabled: open,
    });

    const pickFetchedArray = (type: string, fallback: any[] = []) => {
        const value = fetchedFormData[type];
        return Array.isArray(value) && value.length > 0 ? value : fallback;
    };

    const pickFetchedObject = (
        type: string,
        fallback: Record<string, any> = {},
    ) => {
        const value = fetchedFormData[type];
        return value && !Array.isArray(value) && typeof value === "object"
            ? value
            : fallback;
    };

    const formReferenceData = useMemo(
        () => ({
            leadContacts: pickFetchedArray("leads", props.leadContacts || []),
            employees: pickFetchedArray("employees", props.employees || []),
            leadPipelines: pickFetchedArray(
                "lead-pipelines",
                props.leadPipelines || [],
            ),
            stages: pickFetchedArray("lead-stages", props.stages || []),
            categories: pickFetchedArray("categories", props.categories || []),
            products: pickFetchedArray("products", props.products || []),
            leadAgents: pickFetchedArray("lead-agents", props.leadAgents || []),
            packages: pickFetchedArray("packages", props.packages || []),
            customFields: pickFetchedArray(
                "deal-custom-fields",
                props.dealCustomFields || props.customFields || [],
            ),
            dealCustomFields: pickFetchedArray(
                "deal-custom-fields",
                props.dealCustomFields || props.customFields || [],
            ),
            customFieldCategories: pickFetchedArray(
                "deal-custom-field-categories",
                props.dealCustomFieldCategories ||
                    props.customFieldCategories ||
                    [],
            ),
            dealCustomFieldCategories: pickFetchedArray(
                "deal-custom-field-categories",
                props.dealCustomFieldCategories ||
                    props.customFieldCategories ||
                    [],
            ),
            pipelineCustomFieldCategoryIdsByPipeline: pickFetchedObject(
                "deal-pipeline-custom-field-category-map",
                props.pipelineCustomFieldCategoryIdsByPipeline || {},
            ),
        }),
        [fetchedFormData, props],
    );

    const customFields =
        formReferenceData.dealCustomFields ||
        formReferenceData.customFields ||
        [];

    // Determine if we're editing or creating
    const isEditing = !!deal;
    const isLocked = isEditing && !!deal?.is_locked;
    const submitText = isEditing ? "Update Deal" : "Create Deal";

    // M4/S3: fetch values on edit open (Index rows no longer include custom_fields_data)
    const { data: customFieldsPayload } = useApiQuery<{
        status: string;
        custom_fields_data: Record<string, any>;
    }>({
        path: deal?.id
            ? route("deals.gathering.get_custom_fields", { id: deal.id })
            : "",
        options: {
            enabled: open && !!deal?.id,
            staleTime: 1000 * 60 * 5,
        },
    });

    const customFieldsValues =
        customFieldsPayload?.custom_fields_data ??
        deal?.custom_fields_data ??
        EMPTY_CUSTOM_FIELDS_DATA;

    // Initialize form data - value as { amount, currency } so CurrencyInput can show and persist currency from DB
    const defaultCode = props?.default_currency_code || "TRY";
    const getInitialData = (): CreateDealFormData => ({
        name: deal?.name || "",
        lead_contact: deal?.contact?.id || lead_id || undefined,
        pipeline: deal?.lead_pipeline_id || undefined,
        stage_id: deal?.pipeline_stage_id || undefined,
        value: (deal
            ? {
                  amount: deal.value ?? 0,
                  currency:
                      (deal as any).currency?.currency_code ?? defaultCode,
              }
            : { amount: null, currency: defaultCode }) as any,
        close_date: deal?.close_date || "",
        category_id: deal?.category_id || undefined,
        agent_id: deal?.agent_id || undefined,
        product_id: deal?.products?.map((p) => p.id) || [],
        package_id: deal?.packages?.map((p) => p.id) || [],
        services: deal?.services?.map((s) => s.id) || [],
        deal_watcher: deal?.deal_watchers?.map((w) => w.id) || [],
        deal_participant: deal?.deal_participants?.map((p) => p.id) || [],
        strategy_accepted: !!deal?.strategy_accepted,
        downpayment_confirmed: !!deal?.downpayment_confirmed,
        custom_fields_data:
            constructCustomFieldsData(customFields, customFieldsValues) || {},
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
    >(isEditing ? `/account/deals/${deal!.id}` : "", "PUT");

    // Update form data when deal or modal opens
    useEffect(() => {
        if (open) {
            const initialData = getInitialData();
            setFormData(initialData);
        }
    }, [deal, open, customFields, customFieldsValues]);

    const handleSubmit = (data: CreateDealFormData) => {
        // Clear previous errors
        setErrors([]);

        const mutation = isEditing ? updateDeal : createDeal;

        mutation(data, {
            onSuccess: () => {
                setErrors([]);
                handleCancel();
                router.reload(reloadKeys ? { only: reloadKeys } : undefined);
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
            {isLocked ? (
                <Alert
                    message="Deal Locked"
                    description="This deal is locked and cannot be modified."
                    type="warning"
                    showIcon
                    icon={<LockOutlined />}
                    className="m-4"
                />
            ) : (
                <DealForm
                    data={formData || undefined}
                    disableFields={disableFields}
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
                    formReferenceData={formReferenceData}
                />
            )}
        </Drawer>
    );
};

export default SaveDealModal;
