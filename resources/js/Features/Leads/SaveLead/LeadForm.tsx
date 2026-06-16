import React, { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, Alert } from "antd";
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
    const userEditedRef = useRef(false);
    const { props } = usePage<any>();
    const customFieldCategories =
        props.leadCustomFieldCategories || props.customFieldCategories || [];

    const markUserEdited = useCallback(() => {
        userEditedRef.current = true;
    }, []);

    useEffect(() => {
        if (getIsDirtyRef) {
            getIsDirtyRef.current = () => userEditedRef.current;
        }
    }, [getIsDirtyRef]);

    useEffect(() => {
        if (visible) {
            userEditedRef.current = false;
        } else {
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
                    onUserEdit={markUserEdited}
                />
            ),
        },

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
                    onUserEdit={markUserEdited}
                />
            ) : null,
            disabled: !isEditing,
        })),
    ];

    return (
        <>
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
            />
        </>
    );
};

export default LeadForm;
