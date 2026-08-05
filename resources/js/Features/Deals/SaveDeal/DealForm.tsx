import React, { useMemo, useState, useEffect } from "react";
import { Tabs, Alert } from "antd";
import type { TabsProps } from "antd";
import { CreateDealFormData, Deal } from "@/Types/api/deals";
import { usePage } from "@inertiajs/react";

import CustomFieldTab from "./CustomFieldTab";
import DealDetailsTab from "./DealDetailsTab";
import { filterCategoriesByScope, filterCategoriesForAllFieldsView } from "@/Features/Deals/pipelineScopeUtils";
import DealFieldViewModeToggle from "@/Features/Deals/DealFieldViewModeToggle";
import {
    pipelineHasFieldScopes,
    useDealFieldViewMode,
} from "@/Features/Deals/useDealFieldViewMode";

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
    disableFields?: string[];
    formReferenceData?: Record<string, any>;
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
    disableFields = [],
    formReferenceData = {},
}) => {
    const [activeTab, setActiveTab] = useState("deal");
    const { props } = usePage<any>();
    const [selectedPipelineId, setSelectedPipelineId] = useState<
        number | undefined
    >(data?.pipeline);
    const [selectedStageId, setSelectedStageId] = useState<
        number | undefined
    >(data?.stage_id);

    const dealCustomFields: any[] =
        formReferenceData.dealCustomFields ||
        formReferenceData.customFields ||
        props.dealCustomFields ||
        props.customFields ||
        [];

    const allCustomFieldCategories: any[] =
        formReferenceData.dealCustomFieldCategories ||
        formReferenceData.customFieldCategories ||
        props.dealCustomFieldCategories ||
        props.customFieldCategories ||
        [];

    const pipelineCategoryScopeMap: Record<
        string,
        { pipelineWide?: number[]; byStage?: Record<string, number[]> }
    > =
        formReferenceData.pipelineCategoryScopeMap ||
        props.pipelineCategoryScopeMap ||
        {};

    const pipelineFieldScopeMap =
        formReferenceData.pipelineFieldScopeMap ||
        props.pipelineFieldScopeMap ||
        {};
    const hideAllCategoriesPipelineIds: Array<number | string> =
        formReferenceData.hideAllCategoriesPipelineIds ||
        props.hideAllCategoriesPipelineIds ||
        [];
    const stages = formReferenceData.stages || props.stages || [];
    const { mode: fieldViewMode, setMode: setFieldViewMode, showAllFields } =
        useDealFieldViewMode();

    const hasPipelineScopes = useMemo(
        () =>
            pipelineHasFieldScopes(
                pipelineCategoryScopeMap,
                pipelineFieldScopeMap,
            ),
        [pipelineCategoryScopeMap, pipelineFieldScopeMap],
    );

    useEffect(() => {
        if (data?.pipeline !== undefined) {
            setSelectedPipelineId(data.pipeline);
        }
        if (data?.stage_id !== undefined) {
            setSelectedStageId(data.stage_id);
        }
    }, [data?.pipeline, data?.stage_id]);

    const customFieldCategories = useMemo(() => {
        if (showAllFields) {
            return filterCategoriesForAllFieldsView(
                allCustomFieldCategories,
                pipelineCategoryScopeMap,
                selectedPipelineId,
                null,
                hideAllCategoriesPipelineIds,
            );
        }

        return filterCategoriesByScope(
            allCustomFieldCategories,
            pipelineCategoryScopeMap,
            selectedPipelineId,
            selectedStageId,
            stages,
            null,
            hideAllCategoriesPipelineIds,
        );
    }, [
        showAllFields,
        selectedPipelineId,
        selectedStageId,
        allCustomFieldCategories,
        pipelineCategoryScopeMap,
        stages,
        hideAllCategoriesPipelineIds,
    ]);

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
                    disableFields={disableFields}
                    data={data}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                    loading={loading}
                    submitText={submitText}
                    cancelText={cancelText}
                    onErrorsClear={onErrorsClear}
                    setErrors={setErrors}
                    formReferenceData={formReferenceData}
                    onPipelineChange={(pipelineId) => {
                        setSelectedPipelineId(pipelineId);
                        setSelectedStageId(undefined);
                    }}
                    onStageChange={setSelectedStageId}
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
                    customFields={dealCustomFields}
                    dealCustomFields={dealCustomFields}
                />
            ) : null,
            disabled: data === undefined,
        })),
    ];

    const tabKeys = useMemo(
        () => tabItems.map((item) => item?.key).filter(Boolean) as string[],
        [tabItems],
    );

    useEffect(() => {
        if (!tabKeys.includes(activeTab)) {
            setActiveTab(tabKeys[0] ?? "deal");
        }
    }, [tabKeys, activeTab]);

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

            {hasPipelineScopes && (
                <div className="flex justify-end mb-3">
                    <DealFieldViewModeToggle
                        mode={fieldViewMode}
                        onChange={setFieldViewMode}
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

export default DealForm;
