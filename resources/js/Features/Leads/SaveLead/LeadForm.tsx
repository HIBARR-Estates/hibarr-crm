import React, { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, Alert, FormInstance } from "antd";
import { CreateLeadFormData, Lead } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";
import BasicInfoTab from "./BasicInfoTab";
import CustomFieldTab from "./CustomFieldTab";

export interface LeadFormProps {
    data?: CreateLeadFormData;
    setLead?: (lead: Lead | undefined) => void;
    onSubmit: (values: any) => void;
    onCancel: () => void;
    loading?: boolean;
    errors?: string[];
    setErrors?: (errors: string[]) => void;
    onErrorsClear?: () => void;
    submitText?: string;
    cancelText?: string;
    visible?: boolean;
    isEditing?: boolean;
    getIsDirtyRef?: React.MutableRefObject<(() => boolean) | null>;
}

const LeadForm: React.FC<LeadFormProps> = ({
    data,
    onSubmit,
    onCancel: _onCancel,
    loading = false,
    setLead,
    submitText = "Save Contact",
    cancelText = "Cancel",
    errors = [],
    setErrors,
    onErrorsClear,
    visible,
    isEditing = false,
    getIsDirtyRef,
}) => {
    const [activeTab, setActiveTab] = useState("basic");
    const basicFormRef = useRef<FormInstance | null>(null);
    const customFormRefs = useRef<Map<number, FormInstance>>(new Map());
    const { props } = usePage<any>();
    const customFieldCategories =
        props.leadCustomFieldCategories || props.customFieldCategories || [];

    const registerCustomForm = useCallback(
        (categoryId: number, form: FormInstance | null) => {
            if (form) {
                customFormRefs.current.set(categoryId, form);
            } else {
                customFormRefs.current.delete(categoryId);
            }
        },
        [],
    );

    const getIsDirty = useCallback(() => {
        if (activeTab === "basic") {
            return basicFormRef.current?.isFieldsTouched() ?? false;
        }

        const categoryId = Number(activeTab.replace("custom_", ""));
        if (!Number.isNaN(categoryId)) {
            return (
                customFormRefs.current.get(categoryId)?.isFieldsTouched() ??
                false
            );
        }

        return false;
    }, [activeTab]);

    useEffect(() => {
        if (getIsDirtyRef) {
            getIsDirtyRef.current = getIsDirty;
        }
    }, [getIsDirty, getIsDirtyRef]);

    useEffect(() => {
        if (!visible) {
            setActiveTab("basic");
        }
    }, [visible]);

    const onCancel = () => {
        setActiveTab("basic");
        setErrors?.([]);
        setLead?.(undefined);
        _onCancel?.();
    };
    const tabItems = [
        {
            key: "basic",
            label: "Contact Details",
            children: (
                <BasicInfoTab
                    data={data}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                    loading={loading}
                    submitText={submitText}
                    cancelText={cancelText}
                    onErrorsClear={onErrorsClear}
                    setErrors={setErrors}
                    formRef={basicFormRef}
                />
            ),
        },

        // Add custom field category tabs
        ...customFieldCategories.map((category: any) => ({
            key: `custom_${category.id}`,
            label: category.name,

            children: data ? (
                <CustomFieldTab
                    data={data}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                    loading={loading}
                    submitText={submitText}
                    categoryId={category.id}
                    categoryName={category.name}
                    onFormInstance={(form) =>
                        registerCustomForm(category.id, form)
                    }
                />
            ) : null,
            disabled: !isEditing,
        })),
    ];

    return (
        <>
            {/* Display errors */}
            {errors.length > 0 && (
                <div className="mb-4">
                    <Alert
                        message="Validation Error"
                        description={
                            <ul className="mb-0">
                                {errors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        }
                        type="error"
                        showIcon
                        closable
                        onClose={onErrorsClear}
                    />
                </div>
            )}

            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabItems}
                // type="card"
            />
        </>
    );
};

export default LeadForm;
