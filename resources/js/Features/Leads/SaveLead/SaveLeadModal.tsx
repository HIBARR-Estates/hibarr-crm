import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
} from "react";
import { router, usePage } from "@inertiajs/react";
import { App, Modal } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import { Lead, CreateLeadFormData } from "@/Types/api/leads";
import { IModalProps } from "@/Types/common";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";
import LeadForm from "./LeadForm";
import "./save-lead-modal.css";

/**
 * M4/S3: edit-from-Index loads custom field *values* on open. Index rows no
 * longer include custom_fields_data — do not rely on the lead prop for values.
 */

interface SaveLeadModalProps extends Omit<IModalProps, "onClose"> {
    lead?: Lead;
    setLead?: (lead: Lead | undefined) => void;
    onClose: () => void;
    /**
     * X2: Inertia partial-reload keys after a successful save
     * (e.g. ["leads"] from the Leads Index). Defaults to a full reload
     * for pages that haven't opted in.
     */
    reloadKeys?: string[];
}

/**
 * Form fields use `custom_fields_data.field_{id}` (see GeneralCustomFieldTab /
 * CustomFieldRenderer). Backend + API also use `field_{id}` keys.
 * Accept legacy `{name}_{id}` keys so older payloads still map correctly.
 */
const constructCustomFieldsData = (
    customFields: any[] = [],
    custom_fields_data: Record<string, any> = {},
) => {
    const data: Record<string, any> = {};
    customFields?.forEach((field) => {
        if (!field?.id) return;
        const fieldKey = `field_${field.id}`;
        const legacyKey = `${field?.name}_${field.id}`;
        const value =
            custom_fields_data?.[fieldKey] ??
            custom_fields_data?.[legacyKey];
        if (value !== undefined) {
            data[fieldKey] = value;
        }
    });
    return data;
};

const EMPTY_CUSTOM_FIELDS_DATA: Record<string, any> = {};
const EMPTY_CUSTOM_FIELDS: any[] = [];
const EMPTY_CUSTOM_FIELD_CATEGORIES: any[] = [];

const SaveLeadModal: React.FC<SaveLeadModalProps> = ({
    lead,
    onClose,
    open,
    setLead,
    reloadKeys,
}) => {
    const [errors, setErrors] = useState<string[]>([]);
    const [formData, setFormData] = useState<CreateLeadFormData | null>(null);
    const getIsDirtyRef = useRef<(() => boolean) | null>(null);
    const { modal } = App.useApp();
    const { props } = usePage<any>();
    const queryClient = useQueryClient();

    // M2/S2: fetch lead custom field definitions on open (Index no longer ships them)
    const formDataTypes = useMemo(
        () =>
            [
                "lead-custom-fields",
                "lead-custom-field-categories",
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

    const customFields = useMemo(
        () =>
            pickFetchedArray(
                "lead-custom-fields",
                props.leadCustomFields ||
                    props.customFields ||
                    EMPTY_CUSTOM_FIELDS,
            ),
        [
            fetchedFormData,
            props.leadCustomFields,
            props.customFields,
        ],
    );
    const customFieldCategories = useMemo(
        () =>
            pickFetchedArray(
                "lead-custom-field-categories",
                props.leadCustomFieldCategories ||
                    props.customFieldCategories ||
                    EMPTY_CUSTOM_FIELD_CATEGORIES,
            ),
        [
            fetchedFormData,
            props.leadCustomFieldCategories,
            props.customFieldCategories,
        ],
    );
    const isEditing = !!lead;

    const customFieldsPath =
        lead?.id != null
            ? route("lead-contact.custom-fields", { lead: lead.id })
            : "";

    // M4/S3: fetch values on edit open (Index rows no longer include custom_fields_data).
    // gcTime 0: drop cache when the modal unmounts so reopen always refetches
    // saved Personal/Partner values rather than replaying a stale snapshot.
    const {
        data: customFieldsPayload,
        isPending: customFieldsPending,
        isFetching: customFieldsFetching,
        dataUpdatedAt: customFieldsUpdatedAt,
    } = useApiQuery<{
        status: string;
        custom_fields_data: Record<string, any>;
    }>({
        path: customFieldsPath,
        options: {
            enabled: open && !!lead?.id && !!customFieldsPath,
            staleTime: 0,
            gcTime: 0,
            refetchOnMount: "always",
        },
    });

    const customFieldsValues =
        customFieldsPayload?.custom_fields_data ??
        lead?.custom_fields_data ??
        EMPTY_CUSTOM_FIELDS_DATA;

    // Re-open after save: drop any residual query entry tied to this lead.
    useEffect(() => {
        if (!open || !customFieldsPath) {
            return;
        }
        void queryClient.invalidateQueries({ queryKey: [customFieldsPath] });
    }, [open, customFieldsPath, lead?.id, queryClient]);

    const parseMobile = (mobile: any) => {
        if (!mobile) return "";
        if (typeof mobile === "object") return mobile;
        if (typeof mobile === "string") {
            try {
                const parsed = JSON.parse(mobile);
                if (typeof parsed === "object" && parsed !== null) {
                    if ("countryCode" in parsed && "phoneNumber" in parsed) {
                        return parsed;
                    }
                    return "";
                }
            } catch {
                // Not JSON, treat as plain phone string
            }
        }
        return mobile;
    };

    const getInitialData = (): CreateLeadFormData => ({
        salutation:
            lead?.salutation_value ??
            (lead?.salutation as any)?.value ??
            lead?.salutation ??
            "",
        client_name: lead?.client_name || "",
        client_email: lead?.client_email || "",
        mobile: parseMobile(lead?.mobile),
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
        lead_lifecycle_status_id: lead?.lead_lifecycle_status_id || undefined,
        lead_owner: lead?.lead_owner?.id || undefined,
        added_by: lead?.added_by?.id || undefined,
        create_deal: false,
        create_client: false,
        gender:
            lead?.gender_value ??
            (lead?.gender as any)?.value ??
            lead?.gender ??
            "",
        languages: lead?.languages || [],
        date_of_birth: lead?.date_of_birth || null,
        nationality: lead?.nationality || "",
        occupation: lead?.occupation || "",
        custom_fields_data:
            constructCustomFieldsData(customFields, customFieldsValues) || {},
    });

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

    const isLoading =
        getLoadingStatus({ status: createStatus }) ||
        getLoadingStatus({ status: updateStatus });

    // Editing: wait for custom field values so Personal/Partner tabs are not
    // seeded empty (or from a stale cache) before the refetch lands.
    const customFieldValuesReady =
        !isEditing ||
        !!customFieldsPayload ||
        (!customFieldsPending && !customFieldsFetching);

    useEffect(() => {
        if (!open) {
            setFormData(null);
            return;
        }
        if (!customFieldValuesReady) {
            return;
        }
        setFormData(getInitialData());
        // customFieldsUpdatedAt forces re-seed after a refetch (e.g. reopen).
        // eslint-disable-next-line react-hooks/exhaustive-deps -- getInitialData closes over latest lead/fields
    }, [
        lead,
        open,
        customFields,
        customFieldsValues,
        customFieldValuesReady,
        customFieldsUpdatedAt,
    ]);

    const handleCancel = useCallback(() => {
        setFormData(null);
        setErrors([]);
        onClose();
    }, [onClose]);

    const handleDismiss = useCallback(() => {
        if (isLoading) {
            return;
        }

        const isDirty = getIsDirtyRef.current?.() ?? false;

        if (isDirty) {
            modal.confirm({
                title: "Discard changes?",
                content:
                    "You have unsaved changes. Are you sure you want to close without saving?",
                okText: "Discard",
                okType: "danger",
                cancelText: "Keep editing",
                onOk: handleCancel,
            });
            return;
        }

        handleCancel();
    }, [handleCancel, isLoading, modal]);

    const handleSubmit = (data: CreateLeadFormData) => {
        setErrors([]);

        const mutation = isEditing ? updateLead : createLead;

        mutation(data, {
            onSuccess: () => {
                setErrors([]);
                if (customFieldsPath) {
                    void queryClient.invalidateQueries({
                        queryKey: [customFieldsPath],
                    });
                    queryClient.removeQueries({
                        queryKey: [customFieldsPath],
                    });
                }
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

    const handleErrorsClear = () => {
        setErrors([]);
    };

    return (
        <Modal
            className="save-lead-modal"
            title={null}
            open={open}
            onCancel={handleDismiss}
            footer={null}
            width={1000}
            centered
            destroyOnClose
            maskClosable
            closable
        >
            <div className="px-6 pt-6 pb-5 pr-14 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                    {isEditing ? "Edit lead" : "Add lead"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Fill in the details below. Only name is required.
                </p>
            </div>

            <LeadForm
                data={formData || undefined}
                visible={open}
                onCancel={handleDismiss}
                onSubmit={handleSubmit}
                customFields={customFields}
                customFieldCategories={customFieldCategories}
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
                getIsDirtyRef={getIsDirtyRef}
            />
        </Modal>
    );
};

export default SaveLeadModal;
