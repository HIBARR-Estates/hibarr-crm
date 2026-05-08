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
    deal?: Deal | null; // Optional deal for edit mode
    pipelineId?: number; // Pipeline ID for new deals
    lead?: Lead | null; // Pre-set lead (skips StepOne when creating)
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

    const isEditMode = !!editDeal;
    // When a lead is pre-set and we're creating (not editing), skip StepOne entirely
    const isPresetLead = !!presetLead && !editDeal;

    // Get the pipeline ID from URL params if not provided via props
    const { props } = usePage<any>();
    const urlParams =
        typeof window !== "undefined"
            ? new URLSearchParams(window.location.search)
            : null;
    const urlPipelineId = urlParams?.get("lead_pipeline_id");
    const defaultPipelineId = props.defaultPipeline?.id;

    // Priority: props > URL param > default pipeline
    const pipelineId =
        propsPipelineId ||
        (urlPipelineId ? Number(urlPipelineId) : null) ||
        defaultPipelineId;

    // For steps: use current deal's pipeline when we have a deal (edit or after StepOne), else selected/default pipeline
    const effectivePipelineIdForSteps =
        deal?.lead_pipeline_id ??
        editDeal?.lead_pipeline_id ??
        pipelineId ??
        defaultPipelineId;

    const stepsPath =
        effectivePipelineIdForSteps != null
            ? `${route("deals.gathering.steps")}?pipeline_id=${effectivePipelineIdForSteps}`
            : route("deals.gathering.steps");

    const { data: stepsData, status } = useApiQuery<{ steps: any[] }>({
        path: stepsPath,
    });

    const dynamicSteps = stepsData?.steps || [];
    const loadingSteps = isLoading({ status });

    // Mutation for auto-initializing a deal when lead is pre-set
    const { mutate: autoInitMutate } = useApiMutate<any, any, ApiResponse<any>>(
        route("deals.gathering.init"),
        "POST",
    );

    // Step offset: when lead is pre-set, there's no "Lead Information" step
    const stepOffset = isPresetLead ? 0 : 1;

    // Ref for auto-scrolling content container
    const contentRef = useRef<HTMLDivElement>(null);

    // Initialize state when modal opens with edit deal
    React.useEffect(() => {
        if (open && editDeal) {
            // Edit mode - set deal and lead from existing deal
            setDeal(editDeal);
            // The deal has lead relation loaded as 'contact' (legacy naming)
            if ((editDeal as any).contact) {
                setLead((editDeal as any).contact);
            }
        } else if (!open) {
            // Reset state when modal closes
            setCurrent(0);
            setDeal(null);
            setLead(null);
            setAutoInitializing(false);
        }
    }, [open, editDeal]);

    // Auto-init deal when lead is pre-set (skip StepOne)
    React.useEffect(() => {
        if (
            open &&
            isPresetLead &&
            !deal &&
            !autoInitializing &&
            !loadingSteps
        ) {
            setAutoInitializing(true);
            const leadType = presetLead.company_name ? "agent" : "client";
            const payload: any = {
                lead_type: leadType,
                lead_id: presetLead.id,
            };
            if (pipelineId) {
                payload.pipeline_id = pipelineId;
            }
            autoInitMutate(payload, {
                onSuccess: (response: any) => {
                    if (response.status === "success") {
                        setDeal(response.deal);
                        setLead(response.lead);
                        setCurrent(0); // First step is now the first custom field step
                    }
                    setAutoInitializing(false);
                },
                onError: () => {
                    setAutoInitializing(false);
                    message.error(
                        "Failed to initialize deal. Please try again.",
                    );
                },
            });
        }
    }, [open, isPresetLead, deal, autoInitializing, loadingSteps]);

    // Auto-scroll to top when step changes
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, [current]);

    const handleStepOneNext = (createdDeal: any, createdLead: any) => {
        setDeal(createdDeal);
        setLead(createdLead);
        setCurrent(1);
    };

    const handleNext = () => {
        const nextStep = current + 1;
        const totalSteps = dynamicSteps.length + stepOffset;
        if (nextStep >= totalSteps) {
            // Finish
            message.success("Deal information gathered successfully!");
            onClose();
            // Refresh parent (e.g. reload Inertia)
            router.reload();
        } else {
            setCurrent(nextStep);
        }
    };

    const handlePrev = () => {
        setCurrent(current - 1);
    };

    // Construct Steps items
    // When lead is pre-set, skip "Lead Information" step entirely
    // Otherwise: Step 0 = Lead & Deal (Init), Step 1..N = Dynamic Steps
    const items = isPresetLead
        ? dynamicSteps.map((step) => ({ title: step.title }))
        : [
              {
                  title: "Lead Information",
              },
              ...dynamicSteps.map((step) => ({ title: step.title })),
          ];

    // Calculate which steps should be disabled
    // When lead is pre-set: no steps need disabling based on lead selection
    // Otherwise: all steps after step 0 are disabled until a deal is created;
    //   once created, step 0 (Lead Information) is disabled
    const disabledSteps = isPresetLead
        ? deal
            ? []
            : items.map((_, i) => i) // all disabled until auto-init completes
        : deal
          ? [0]
          : items.slice(1).map((_, i) => i + 1);

    // Handle step navigation via click
    const handleStepClick = (stepIndex: number) => {
        // Don't allow navigation to steps beyond current + 1 (can't skip ahead)
        // Don't allow going back to step 0 once a deal is created (only relevant when not pre-set)
        if (!isPresetLead && deal && stepIndex === 0) {
            return; // Prevent going back to step 0 after deal creation
        }
        if (stepIndex <= current || stepIndex === current + 1) {
            setCurrent(stepIndex);
        }
    };

    const renderContent = () => {
        let content = null;

        // Prevent editing locked deals
        if (isEditMode && editDeal?.is_locked) {
            content = (
                <div className="py-12 px-4">
                    <Alert
                        message="Deal Locked"
                        description="This deal is locked and cannot be modified."
                        type="warning"
                        showIcon
                        icon={<LockOutlined />}
                    />
                </div>
            );
            return <div className="min-h-[300px]">{content}</div>;
        }

        // Show loading state during auto-initialization
        if (autoInitializing) {
            content = (
                <div className="py-12">
                    <Skeleton active paragraph={{ rows: 6 }} />
                </div>
            );
        } else if (!isPresetLead && current === 0) {
            // StepOne: only shown when lead is NOT pre-set
            content = (
                <StepOne
                    onNext={handleStepOneNext}
                    existingLead={lead}
                    existingDeal={deal}
                    pipelineId={pipelineId}
                />
            );
        } else {
            // Adjust index for dynamic steps using stepOffset
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
                // Fallback for no custom field steps
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
                            onClick={() => {
                                onClose();
                                router.reload();
                            }}
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

                    {/* Attach Properties action — available once a deal exists */}
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
