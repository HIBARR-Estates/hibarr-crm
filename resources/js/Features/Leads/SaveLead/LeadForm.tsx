import React, { useState, useEffect } from "react";
import { Form, Tabs, Button, Space, Alert } from "antd";
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
}

const LeadForm: React.FC<LeadFormProps> = ({
    data,
    onSubmit,
    onCancel: _onCancel,
    loading = false,
    setLead,
    submitText = "Save Lead",
    cancelText = "Cancel",
    errors = [],
    setErrors,
    onErrorsClear,
    visible,
}) => {
    const [activeTab, setActiveTab] = useState("basic");
    const { props } = usePage<any>();
    const customFieldCategories =
        props.leadCustomFieldCategories || props.customFieldCategories || [];

    useEffect(() => {
        if (!visible) {
            setActiveTab("deal");
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
            label: "Lead Details",
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
                />
            ) : null,
            disabled: data === undefined,
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
