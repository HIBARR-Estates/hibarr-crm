import React, { useState } from "react";
import { Modal, message, Button, Skeleton } from "antd";
import StepOne from "./StepOne";
import CustomFieldStep from "./CustomFieldStep";
import ModernSteps from "./ModernSteps";
import { router, usePage } from "@inertiajs/react";
import { useApiQuery } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import { Deal } from "@/Types/api/deals";

interface Props {
    open: boolean;
    onClose: () => void;
    deal?: Deal | null; // Optional deal for edit mode
    pipelineId?: number; // Pipeline ID for new deals
}

const DealInformationGatheringForm: React.FC<Props> = ({
    open,
    onClose,
    deal: editDeal,
    pipelineId: propsPipelineId,
}) => {
    const [current, setCurrent] = useState(0);
    const [deal, setDeal] = useState<any>(null);
    const [lead, setLead] = useState<any>(null);

    const isEditMode = !!editDeal;

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

    const { data: stepsData, status } = useApiQuery<{ steps: any[] }>({
        path: route("deals.gathering.steps"),
    });

    const dynamicSteps = stepsData?.steps || [];
    const loadingSteps = isLoading({ status });

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
        }
    }, [open, editDeal]);

    const handleStepOneNext = (createdDeal: any, createdLead: any) => {
        setDeal(createdDeal);
        setLead(createdLead);
        setCurrent(1);
    };

    const handleNext = () => {
        const nextStep = current + 1;
        if (nextStep > dynamicSteps.length) {
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
    // Step 0: Lead & Deal (Init)
    // Step 1..N: Dynamic Steps
    const items = [
        {
            title: "Lead Information",
        },
        ...dynamicSteps.map((step) => ({ title: step.title })),
    ];

    // Calculate which steps should be disabled
    // All steps after step 0 are disabled until a deal is created
    const disabledSteps = deal ? [] : items.slice(1).map((_, i) => i + 1);

    // Handle step navigation via click
    const handleStepClick = (stepIndex: number) => {
        // Don't allow navigation to steps beyond current + 1 (can't skip ahead)
        // But allow going back to any completed step
        if (stepIndex <= current || stepIndex === current + 1) {
            setCurrent(stepIndex);
        }
    };

    const renderContent = () => {
        let content = null;

        if (current === 0) {
            content = (
                <StepOne
                    onNext={handleStepOneNext}
                    existingLead={lead}
                    existingDeal={deal}
                    pipelineId={pipelineId}
                />
            );
        } else {
            // Adjust index for dynamic steps (current - 1)
            const stepIndex = current - 1;

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
            } else if (dynamicSteps.length === 0 && current === 1) {
                // Fallback for no steps
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

        return <div className="min-h-[400px]">{content}</div>;
    };

    return (
        <Modal
            title={
                <span className="text-xl font-semibold">
                    {isEditMode
                        ? `Edit: ${deal?.name ?? editDeal?.name}`
                        : deal?.name ?? "New Deal"}
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
            <Skeleton loading={loadingSteps} active paragraph={{ rows: 10 }}>
                <div>
                    <ModernSteps
                        current={current}
                        items={items}
                        onStepClick={handleStepClick}
                        disabledSteps={disabledSteps}
                    />
                    <div>{renderContent()}</div>
                </div>
            </Skeleton>
        </Modal>
    );
};

export default DealInformationGatheringForm;
