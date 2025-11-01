import React, { useState, useEffect } from "react";
import { Tabs, Alert } from "antd";
import type { TabsProps } from "antd";
import { CreateDealFormData, Deal } from "@/Types/api/deals";
import { usePage } from "@inertiajs/react";

import CustomFieldTab from "./CustomFieldTab";
import DealDetailsTab from "./DealDetailsTab";

export interface DealFormProps {
    data?: CreateDealFormData;
    setDeal?: (deal: Deal | undefined) => void;
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

const DealForm: React.FC<DealFormProps> = ({
    data,
    onSubmit,
    onCancel: _onCancel,
    loading = false,
    setDeal,
    submitText = "Save Deal",
    cancelText = "Cancel",
    errors = [],
    setErrors,
    onErrorsClear,
    visible,
}) => {
    const [activeTab, setActiveTab] = useState("deal");
    const { props } = usePage<any>();
    const { customFieldCategories = [] } = props;

    useEffect(() => {
        if (!visible) {
            setActiveTab("deal");
        }
    }, [visible]);

    const onCancel = () => {
        setActiveTab("basic");
        setErrors?.([]);
        setDeal?.(undefined);
        _onCancel?.();
    };

    const tabItems: TabsProps["items"] = [
        {
            key: "deal",
            label: "Deal Details",
            children: (
                <DealDetailsTab
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
                type="card"
            />
        </>
    );
};

export default DealForm;
