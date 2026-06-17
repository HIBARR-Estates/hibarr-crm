import React, { useState, useEffect, useRef, useCallback } from "react";
import { router, usePage } from "@inertiajs/react";
import { App, Modal } from "antd";
import { Lead, CreateLeadFormData } from "@/Types/api/leads";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import LeadForm from "./LeadForm";
import "./save-lead-modal.css";

interface SaveLeadModalProps extends Omit<IModalProps, "onClose"> {
    lead?: Lead;
    setLead?: (lead: Lead | undefined) => void;
    onClose: () => void;
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

const SaveLeadModal: React.FC<SaveLeadModalProps> = ({
    lead,
    onClose,
    open,
    setLead,
}) => {
    const [errors, setErrors] = useState<string[]>([]);
    const [formData, setFormData] = useState<CreateLeadFormData | null>(null);
    const getIsDirtyRef = useRef<(() => boolean) | null>(null);
    const { modal } = App.useApp();
    const { props } = usePage<any>();

    const customFields = props.leadCustomFields || props.customFields || [];
    const isEditing = !!lead;

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
            constructCustomFieldsData(customFields, lead?.custom_fields_data) ||
            {},
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

    useEffect(() => {
        if (open) {
            const initialData = getInitialData();
            setFormData(initialData);
        }
    }, [lead, open, customFields]);

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
