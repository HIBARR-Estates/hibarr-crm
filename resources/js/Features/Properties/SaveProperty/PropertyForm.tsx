import { useState, useEffect } from "react";
import { Form, Tabs, Alert } from "antd";
import type { TabsProps } from "antd";
import { Property } from "@/Types";

// Import tab components
import BasicInfoTab from "./BasicInfoTab";
import LocationInfoTab from "./LocationInfoTab";
import PropertyDetailsTab from "./PropertyDetailsTab";
import LegalFinancialTab from "./LegalFinancialTab";
import AssetsTab from "./AssetsTab";
import FeaturesAndAddOnsTab from "./FeaturesAndAddOnsTab";

export interface PropertyFormProps {
    data?: Partial<Property>;
    setProperty?: (property: Property | undefined) => void;
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

export default function PropertyForm({
    data,
    onSubmit,
    onCancel: _onCancel,
    loading = false,
    errors = [],
    onErrorsClear,
    submitText = "Submit",
    cancelText = "Cancel",
    setErrors,
    setProperty,
    visible,
}: PropertyFormProps) {
    const [activeTab, setActiveTab] = useState("basic");
    useEffect(() => {
        if (!visible) {
            setActiveTab("basic");
        }
    }, [visible]);
    const onCancel = () => {
        setActiveTab("basic");
        setErrors?.([]);
        setProperty?.(undefined);
        _onCancel?.();
    };

    const tabItems: TabsProps["items"] = [
        {
            key: "basic",
            label: "Basic Info",
            children: (
                <BasicInfoTab
                    onSubmit={onSubmit}
                    onErrorsClear={onErrorsClear}
                    setErrors={setErrors}
                    onCancel={onCancel}
                    setProperty={setProperty}
                    data={data}
                    cancelText={cancelText}
                    loading={loading}
                    submitText={submitText}
                />
            ),
        },
        {
            key: "location",
            label: "Location",
            children: (
                <LocationInfoTab
                    onCancel={onCancel}
                    cancelText={cancelText}
                    loading={loading}
                    submitText={submitText}
                    onSubmit={onSubmit}
                    data={data}
                    onErrorsClear={onErrorsClear}
                    setErrors={setErrors}
                />
            ),
            disabled: data === undefined,
        },
        {
            key: "details",
            label: "Details",
            children: (
                <PropertyDetailsTab
                    onCancel={onCancel}
                    cancelText={cancelText}
                    loading={loading}
                    submitText={submitText}
                    onSubmit={onSubmit}
                    data={data}
                    onErrorsClear={onErrorsClear}
                    setErrors={setErrors}
                />
            ),
            disabled: data === undefined,
        },
        {
            key: "legal",
            label: "Legal & Finance",
            children: (
                <LegalFinancialTab
                    onCancel={onCancel}
                    cancelText={cancelText}
                    loading={loading}
                    submitText={submitText}
                    onSubmit={onSubmit}
                    data={data}
                    onErrorsClear={onErrorsClear}
                    setErrors={setErrors}
                />
            ),
            disabled: data === undefined,
        },
        {
            key: "features",
            label: "Features & Add-Ons",
            children: (
                <FeaturesAndAddOnsTab
                    onCancel={onCancel}
                    cancelText={cancelText}
                    loading={loading}
                    submitText={submitText}
                    onSubmit={onSubmit}
                    data={data}
                    onErrorsClear={onErrorsClear}
                    setErrors={setErrors}
                />
            ),
            disabled: data === undefined,
        },
        {
            key: "assets",
            label: "Assets",
            children: data ? (
                <AssetsTab property={data} canEdit={true} />
            ) : null,
            disabled: data === undefined, // Only show for existing properties
        },
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
}
