import React, { useState } from "react";
import { Button, Select } from "antd";
import {
    ArrowLeftOutlined,
    ArrowRightOutlined,
    StopOutlined,
} from "@ant-design/icons";
import { Lead } from "@/Types/api/leads";
import {
    LeadQualification,
    QualificationOutcome,
    TemplateTree,
} from "@/Types/qualification";
import { LeadQualificationService } from "@/Services/LeadQualificationService";
import { RegistrationService } from "@/Services/RegistrationService";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import useQualificationFlow from "./useQualificationFlow";
import LeadQualificationHeader from "./LeadQualificationHeader";
import BranchProgressBar from "./BranchProgressBar";
import SegmentCard from "./SegmentCard";
import CaptureSummaryRail from "./CaptureSummaryRail";
import QualificationActionsPanel from "./QualificationActionsPanel";
import { findEntrySegment } from "./qualificationUtils";

interface InProgressViewProps {
    lead: Lead;
    qualification: LeadQualification;
    templateTree: TemplateTree;
    qualificationService: LeadQualificationService;
    registrationService: RegistrationService;
    onQualificationUpdated: (qualification: LeadQualification) => void;
    onActionsDone?: (qualification: LeadQualification) => void;
    onAbandoned: () => void;
}

const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "de", label: "German" },
    { value: "tr", label: "Turkish" },
    { value: "ru", label: "Russian" },
];

const InProgressView: React.FC<InProgressViewProps> = ({
    lead,
    qualification,
    templateTree,
    qualificationService,
    registrationService,
    onQualificationUpdated,
    onActionsDone,
    onAbandoned,
}) => {
    const [agentLanguage, setAgentLanguage] = useState(
        qualification.agent_language || "en",
    );
    const [completedQualification, setCompletedQualification] =
        useState<LeadQualification | null>(null);

    const flow = useQualificationFlow({
        lead,
        qualification,
        templateTree,
        service: qualificationService,
        registrationService,
        agentLanguage,
        onQualificationUpdated: (updated) => {
            if (updated.status === "completed") {
                setCompletedQualification(updated);
            }
            onQualificationUpdated(updated);
        },
    });

    const entrySegment = findEntrySegment(templateTree);
    const branchLabel =
        entrySegment && flow.answers[entrySegment.key]
            ? entrySegment.options?.find((o) =>
                  flow.answers[entrySegment.key]?.answer_values.includes(o.id),
              )?.label
            : undefined;

    const handleCompleteOutcomes = async (
        outcomes: QualificationOutcome[],
        metadata?: {
            comment?: string | null;
        },
    ) => {
        return flow.completeWithOutcomes(outcomes, metadata);
    };

    const handleAbandon = async () => {
        await flow.abandon();
        onAbandoned();
    };

    const showingActions =
        completedQualification != null &&
        (completedQualification.action_runs?.length ?? 0) > 0;

    const showNav =
        !showingActions && flow.currentSegment?.type !== "outcome";

    return (
        <DynamicTranslationProvider locale={agentLanguage}>
            <div className="flex flex-col min-h-[600px]">
                <LeadQualificationHeader lead={lead} />

                <div className="flex items-center justify-end gap-3 px-6 py-2 border-b border-gray-100 bg-white">
                    <span className="text-sm text-gray-500">Script language</span>
                    <Select
                        size="small"
                        value={agentLanguage}
                        onChange={setAgentLanguage}
                        options={LANGUAGE_OPTIONS}
                        className="w-32"
                        disabled={showingActions}
                    />
                    {!showingActions ? (
                        <Button
                            type="text"
                            danger
                            size="small"
                            icon={<StopOutlined />}
                            onClick={handleAbandon}
                            loading={flow.completing}
                        >
                            Abandon
                        </Button>
                    ) : null}
                </div>

                {!showingActions ? (
                    <BranchProgressBar
                        visibleSegments={flow.visibleSegments}
                        currentIndex={flow.currentIndex}
                        branchLabel={branchLabel}
                    />
                ) : null}

                <div className="flex flex-1 min-h-0">
                    <div className="flex-1 p-6 overflow-y-auto">
                        {showingActions && completedQualification ? (
                            <QualificationActionsPanel
                                lead={lead}
                                qualification={completedQualification}
                                qualificationService={qualificationService}
                                registrationService={registrationService}
                                agentLanguage={agentLanguage}
                                variant="legacy"
                                onUpdated={(updated) => {
                                    setCompletedQualification(updated);
                                    onQualificationUpdated(updated);
                                }}
                                onDone={() => {
                                    if (completedQualification) {
                                        (onActionsDone ?? onQualificationUpdated)(
                                            completedQualification,
                                        );
                                    }
                                }}
                            />
                        ) : (
                            <>
                                {flow.currentSegment && (
                                    <SegmentCard
                                        segment={flow.currentSegment}
                                        answer={
                                            flow.answers[flow.currentSegment.key]
                                        }
                                        tokenMap={flow.tokenMap}
                                        translateScript={flow.translateScript}
                                        templateTree={templateTree}
                                        onAnswerChange={(values, text) =>
                                            flow.applyAnswerChange(
                                                flow.currentSegment!,
                                                values,
                                                text,
                                            )
                                        }
                                        onCompleteOutcomes={
                                            handleCompleteOutcomes
                                        }
                                        saving={flow.saving}
                                        completing={flow.completing}
                                    />
                                )}

                                {showNav && (
                                    <div className="flex justify-between mt-6">
                                        <Button
                                            icon={<ArrowLeftOutlined />}
                                            onClick={flow.goBack}
                                            disabled={
                                                !flow.canGoBack || flow.saving
                                            }
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            type="primary"
                                            icon={<ArrowRightOutlined />}
                                            iconPosition="end"
                                            onClick={() => void flow.goNext()}
                                            disabled={
                                                flow.isLastSegment ||
                                                flow.saving ||
                                                Boolean(flow.validationError)
                                            }
                                            loading={flow.saving}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {!showingActions ? (
                        <CaptureSummaryRail
                            visibleSegments={flow.visibleSegments}
                            answers={flow.answers}
                            currentSegmentKey={flow.currentSegment?.key}
                        />
                    ) : null}
                </div>
            </div>

        </DynamicTranslationProvider>
    );
};

export default InProgressView;
