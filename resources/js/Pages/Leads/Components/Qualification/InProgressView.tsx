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
import BranchChangeWarningModal from "./BranchChangeWarningModal";
import WebinarSessionPickerModal from "./WebinarSessionPickerModal";
import { findEntrySegment } from "./qualificationUtils";

interface InProgressViewProps {
    lead: Lead;
    qualification: LeadQualification;
    templateTree: TemplateTree;
    qualificationService: LeadQualificationService;
    registrationService: RegistrationService;
    onQualificationUpdated: (qualification: LeadQualification) => void;
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
    onAbandoned,
}) => {
    const [agentLanguage, setAgentLanguage] = useState(
        qualification.agent_language || "en",
    );
    const [webinarPickerOpen, setWebinarPickerOpen] = useState(false);
    const [pendingWebinarId, setPendingWebinarId] = useState<string | null>(
        null,
    );
    const [pendingComplete, setPendingComplete] = useState<{
        outcomes: QualificationOutcome[];
        comment: string | null;
        calendlyUrl?: string;
    } | null>(null);

    const flow = useQualificationFlow({
        lead,
        qualification,
        templateTree,
        service: qualificationService,
        registrationService,
        agentLanguage,
        onQualificationUpdated,
    });

    const entrySegment = findEntrySegment(templateTree);
    const branchLabel =
        entrySegment && flow.answers[entrySegment.key]
            ? entrySegment.options?.find((o) =>
                  flow.answers[entrySegment.key]?.answer_values.includes(o.id),
              )?.label
            : undefined;

    const handleWebinarSelect = async (
        sessionId: string,
        sessionLabel: string,
    ) => {
        if (!pendingComplete) return;
        setWebinarPickerOpen(false);
        await flow.completeWithOutcomes(pendingComplete.outcomes, {
            comment: pendingComplete.comment,
            webinarSessionId: sessionId,
            webinarSessionLabel: sessionLabel,
            calendlyUrl: pendingComplete.calendlyUrl,
        });
        setPendingComplete(null);
        setPendingWebinarId(null);
    };

    const handleCompleteOutcomes = async (
        outcomes: QualificationOutcome[],
        metadata?: {
            comment?: string | null;
            webinarSessionId?: string;
            webinarSessionLabel?: string;
            calendlyUrl?: string;
        },
    ) => {
        await flow.completeWithOutcomes(outcomes, metadata);
    };

    const handleAbandon = async () => {
        await flow.abandon();
        onAbandoned();
    };

    const showNav = flow.currentSegment?.type !== "outcome";

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
                    />
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
                </div>

                <BranchProgressBar
                    visibleSegments={flow.visibleSegments}
                    currentIndex={flow.currentIndex}
                    branchLabel={branchLabel}
                />

                <div className="flex flex-1 min-h-0">
                    <div className="flex-1 p-6 overflow-y-auto">
                        {flow.currentSegment && (
                            <SegmentCard
                                segment={flow.currentSegment}
                                answer={flow.answers[flow.currentSegment.key]}
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
                                onCompleteOutcomes={handleCompleteOutcomes}
                                onOpenWebinarPicker={(webinarId, pending) => {
                                    setPendingComplete(pending);
                                    setPendingWebinarId(webinarId);
                                    setWebinarPickerOpen(true);
                                }}
                                saving={flow.saving}
                                completing={flow.completing}
                            />
                        )}

                        {showNav && (
                            <div className="flex justify-between mt-6">
                                <Button
                                    icon={<ArrowLeftOutlined />}
                                    onClick={flow.goBack}
                                    disabled={!flow.canGoBack || flow.saving}
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
                    </div>

                    <CaptureSummaryRail
                        visibleSegments={flow.visibleSegments}
                        answers={flow.answers}
                        currentSegmentKey={flow.currentSegment?.key}
                    />
                </div>
            </div>

            <BranchChangeWarningModal
                open={Boolean(flow.branchChangePending)}
                onConfirm={flow.confirmBranchChange}
                onCancel={flow.cancelBranchChange}
                loading={flow.saving}
            />

            {pendingWebinarId && (
                <WebinarSessionPickerModal
                    open={webinarPickerOpen}
                    webinarId={pendingWebinarId}
                    registrationService={registrationService}
                    onClose={() => {
                        setWebinarPickerOpen(false);
                        setPendingComplete(null);
                        setPendingWebinarId(null);
                    }}
                    onSelect={handleWebinarSelect}
                />
            )}
        </DynamicTranslationProvider>
    );
};

export default InProgressView;
