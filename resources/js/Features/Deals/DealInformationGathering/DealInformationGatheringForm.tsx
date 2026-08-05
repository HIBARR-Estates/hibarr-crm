import React, { useState, useRef, useEffect } from "react";
import { Modal, message, Button, Skeleton, Alert } from "antd";
import { LockOutlined, HomeOutlined } from "@ant-design/icons";
import StepOne from "./StepOne";
import CustomFieldStep from "./CustomFieldStep";
import ModernSteps from "./ModernSteps";
import { router, usePage } from "@inertiajs/react";
import { useApiQuery, useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import { Deal } from "@/Types/api/deals";
import { Lead } from "@/Types/api/leads";
import { ApiResponse } from "@/lib/api/types";
import ManageDealPropertiesModal from "@/Features/Deals/Properties/AttachPropertiesModal";

interface Props {
    open: boolean;
    onClose: () => void;
    deal?: Deal | null;
    pipelineId?: number;
    lead?: Lead | null;
}

const DealInformationGatheringForm: React.FC<Props> = ({
    open,
    onClose,
    deal: editDeal,
    pipelineId: propsPipelineId,
    lead: presetLead,
}) => {
    const [current, setCurrent] = useState(0);
    const [deal, setDeal] = useState<any>(null);
    const [lead, setLead] = useState<any>(null);
    const [autoInitializing, setAutoInitializing] = useState(false);
    const [propertyModalOpen, setPropertyModalOpen] = useState(false);
    const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

    const isEditMode = !!editDeal;
    const isPresetLead = !!presetLead && !editDeal;

    const { props } = usePage<any>();
    const urlParams =
        typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
    const urlPipelineId = urlParams?.get("lead_pipeline_id");
    const defaultPipelineId = props.defaultPipeline?.id;
    const allPipelines: any[] = (props.allPipelines as any[]) ?? [];

    // Show pipeline picker only when: caller hasn't pre-selected one, there are multiple choices,
    // and we're not in edit mode (edit mode always has a pipeline already)
    const needsPipelineStep =
        !isEditMode &&
        !propsPipelineId &&
        !urlPipelineId &&
        allPipelines.length > 1;

    // Effective pipeline: explicit selection > URL > page default
    const resolvedPipelineId =
        selectedPipelineId ??
        propsPipelineId ??
        (urlPipelineId ? Number(urlPipelineId) : null) ??
        defaultPipelineId;

    const effectivePipelineIdForSteps =
        deal?.lead_pipeline_id ??
        editDeal?.lead_pipeline_id ??
        resolvedPipelineId;

    const stepsPath =
        effectivePipelineIdForSteps != null
            ? `${route("deals.gathering.steps")}?pipeline_id=${effectivePipelineIdForSteps}`
            : route("deals.gathering.steps");

    const { data: stepsData, status } = useApiQuery<{ steps: any[] }>({
        path: stepsPath,
    });

    const dynamicSteps = stepsData?.steps || [];
    const loadingSteps = isLoading({ status });

    const { mutate: autoInitMutate } = useApiMutate<any, any, ApiResponse<any>>(
        route("deals.gathering.init"),
        "POST",
    );

    // How many manual steps precede the dynamic steps
    const pipelineStepOffset = needsPipelineStep ? 1 : 0;
    const stepOffset = (isPresetLead ? 0 : 1) + pipelineStepOffset;

    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && editDeal) {
            setDeal(editDeal);
            if ((editDeal as any).contact) {
                setLead((editDeal as any).contact);
            }
        } else if (!open) {
            setCurrent(0);
            setDeal(null);
            setLead(null);
            setAutoInitializing(false);
            setSelectedPipelineId(null);
        }
    }, [open, editDeal]);

    // Auto-init when lead is preset — blocked until pipeline is selected (if required)
    useEffect(() => {
        if (
            open &&
            isPresetLead &&
            !deal &&
            !autoInitializing &&
            !loadingSteps &&
            (!needsPipelineStep || selectedPipelineId !== null)
        ) {
            setAutoInitializing(true);
            const leadType = presetLead.company_name ? "agent" : "client";
            const payload: any = { lead_type: leadType, lead_id: presetLead.id };
            if (resolvedPipelineId) payload.pipeline_id = resolvedPipelineId;
            autoInitMutate(payload, {
                onSuccess: (response: any) => {
                    if (response.status === "success") {
                        setDeal(response.deal);
                        setLead(response.lead);
                        setCurrent(pipelineStepOffset); // first dynamic step
                    }
                    setAutoInitializing(false);
                },
                onError: () => {
                    setAutoInitializing(false);
                    message.error("Failed to initialize deal. Please try again.");
                },
            });
        }
    }, [open, isPresetLead, deal, autoInitializing, loadingSteps, selectedPipelineId]);

    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [current]);

    const handlePipelineSelect = (id: number) => {
        setSelectedPipelineId(id);
        // Advance past the pipeline step to lead info (or first dynamic step if preset lead)
        setCurrent(pipelineStepOffset);
    };

    const handleStepOneNext = (createdDeal: any, createdLead: any) => {
        setDeal(createdDeal);
        setLead(createdLead);
        setCurrent((c) => c + 1);
    };

    const handleNext = () => {
        const nextStep = current + 1;
        const totalSteps = dynamicSteps.length + stepOffset;
        if (nextStep >= totalSteps) {
            message.success("Deal information gathered successfully!");
            onClose();
            router.reload();
        } else {
            setCurrent(nextStep);
        }
    };

    const handlePrev = () => {
        setCurrent((c) => c - 1);
    };

    const items = [
        ...(needsPipelineStep ? [{ title: "Select Pipeline" }] : []),
        ...(isPresetLead ? [] : [{ title: "Lead Information" }]),
        ...dynamicSteps.map((step) => ({ title: step.title })),
    ];

    const leadInfoStepIndex = pipelineStepOffset;

    let disabledSteps: number[];
    if (isPresetLead) {
        disabledSteps = deal ? [] : items.map((_, i) => i);
    } else if (needsPipelineStep) {
        if (deal) {
            disabledSteps = [leadInfoStepIndex];
        } else if (selectedPipelineId !== null) {
            disabledSteps = items.slice(leadInfoStepIndex + 1).map((_, i) => i + leadInfoStepIndex + 1);
        } else {
            disabledSteps = items.slice(1).map((_, i) => i + 1);
        }
    } else {
        disabledSteps = deal ? [0] : items.slice(1).map((_, i) => i + 1);
    }

    const handleStepClick = (stepIndex: number) => {
        if (!isPresetLead && deal && stepIndex === leadInfoStepIndex) return;
        if (stepIndex <= current || stepIndex === current + 1) {
            setCurrent(stepIndex);
        }
    };

    const renderPipelineStep = () => (
        <div className="py-8 px-4">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Select a Pipeline</h3>
                <p className="text-gray-500 max-w-md mx-auto text-sm">
                    Choose which pipeline this deal belongs to before continuing.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                {allPipelines.map((pipeline: any) => (
                    <button
                        key={pipeline.id}
                        type="button"
                        onClick={() => handlePipelineSelect(pipeline.id)}
                        className="group relative flex flex-col items-start p-5 rounded-xl border-2 text-left transition-all duration-150 hover:shadow-md bg-white hover:bg-gray-50 active:scale-[0.98]"
                        style={{ borderColor: pipeline.label_color || "#e5e7eb" }}
                    >
                        <div
                            className="w-3 h-3 rounded-full mb-3"
                            style={{ background: pipeline.label_color || "#6b7280" }}
                        />
                        <div className="font-semibold text-gray-800 text-sm leading-snug">
                            {pipeline.name}
                        </div>
                        {pipeline.stages?.length > 0 && (
                            <div className="text-xs text-gray-400 mt-1">
                                {pipeline.stages.length} stage{pipeline.stages.length !== 1 ? "s" : ""}
                            </div>
                        )}
                        <div
                            className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: pipeline.label_color || "#6b7280" }}
                        />
                    </button>
                ))}
            </div>
        </div>
    );

    const renderContent = () => {
        if (isEditMode && editDeal?.is_locked) {
            return (
                <div className="min-h-[300px] py-12 px-4">
                    <Alert
                        message="Deal Locked"
                        description="This deal is locked and cannot be modified."
                        type="warning"
                        showIcon
                        icon={<LockOutlined />}
                    />
                </div>
            );
        }

        if (autoInitializing) {
            return (
                <div className="min-h-[300px] py-12">
                    <Skeleton active paragraph={{ rows: 6 }} />
                </div>
            );
        }

        let content: React.ReactNode = null;

        if (needsPipelineStep && current === 0) {
            content = renderPipelineStep();
        } else if (!isPresetLead && current === leadInfoStepIndex) {
            content = (
                <StepOne
                    onNext={handleStepOneNext}
                    existingLead={lead}
                    existingDeal={deal}
                    pipelineId={resolvedPipelineId}
                />
            );
        } else {
            const stepIndex = current - stepOffset;
            if (stepIndex >= 0 && stepIndex < dynamicSteps.length) {
                content = (
                    <CustomFieldStep
                        deal={deal}
                        stepConfig={dynamicSteps[stepIndex]}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        isLast={stepIndex === dynamicSteps.length - 1}
                    />
                );
            } else if (
                dynamicSteps.length === 0 &&
                (current === stepOffset || (isPresetLead && deal))
            ) {
                content = (
                    <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <div className="text-5xl mb-4">🎉</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                            Deal Created Successfully
                        </h3>
                        <p className="text-gray-500 mb-6">
                            All information has been gathered.
                        </p>
                        <Button
                            type="primary"
                            size="large"
                            onClick={() => { onClose(); router.reload(); }}
                        >
                            Complete & Close
                        </Button>
                    </div>
                );
            }
        }

        return <div className="min-h-[300px]">{content}</div>;
    };

    return (
        <Modal
            title={
                <span className="text-xl font-semibold">
                    {isEditMode
                        ? `Edit: ${deal?.name ?? editDeal?.name}`
                        : (deal?.name ?? "New Deal")}
                </span>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={1000}
            destroyOnHidden
            maskClosable={false}
            className="top-8"
        >
            <Skeleton
                loading={loadingSteps || autoInitializing}
                active
                paragraph={{ rows: 10 }}
            >
                <div>
                    <ModernSteps
                        current={current}
                        items={items}
                        onStepClick={handleStepClick}
                        disabledSteps={disabledSteps}
                    />
                    <div
                        ref={contentRef}
                        className="overflow-y-auto overflow-x-hidden max-h-[70vh]"
                    >
                        {renderContent()}
                    </div>

                    {(deal || editDeal) && (
                        <>
                            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                                <Button
                                    type="default"
                                    icon={<HomeOutlined />}
                                    onClick={() => setPropertyModalOpen(true)}
                                    size="small"
                                >
                                    Attach Properties
                                </Button>
                            </div>
                            <ManageDealPropertiesModal
                                open={propertyModalOpen}
                                onClose={() => setPropertyModalOpen(false)}
                                deal={deal || editDeal!}
                                onRefresh={() => {}}
                            />
                        </>
                    )}
                </div>
            </Skeleton>
        </Modal>
    );
};

export default DealInformationGatheringForm;
