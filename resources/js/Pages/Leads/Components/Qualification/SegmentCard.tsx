import React from "react";
import {
    Segment,
    QualificationToken,
    SegmentAnswerState,
    TemplateTree,
    QualificationOutcome,
} from "@/Types/qualification";
import SaySegment from "./segments/SaySegment";
import QuestionSegment from "./segments/QuestionSegment";
import InstructionSegment from "./segments/InstructionSegment";
import OutcomeSegment from "./segments/OutcomeSegment";

interface SegmentCardProps {
    segment: Segment;
    answer?: SegmentAnswerState;
    tokenMap: Record<QualificationToken, string>;
    translateScript: (text: string) => string;
    templateTree: TemplateTree;
    onAnswerChange: (values: string[], text?: string | null) => void;
    onCompleteOutcomes: (
        outcomes: QualificationOutcome[],
        metadata?: {
            comment?: string | null;
            webinarSessionId?: string;
            webinarSessionLabel?: string;
            calendlyUrl?: string;
        },
    ) => Promise<void>;
    onOpenWebinarPicker?: (
        webinarId: string,
        pending: {
            outcomes: QualificationOutcome[];
            comment: string | null;
            calendlyUrl?: string;
        },
    ) => void;
    saving?: boolean;
    completing?: boolean;
}

const SegmentCard: React.FC<SegmentCardProps> = ({
    segment,
    answer,
    tokenMap,
    translateScript,
    templateTree,
    onAnswerChange,
    onCompleteOutcomes,
    onOpenWebinarPicker,
    saving = false,
    completing = false,
}) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 min-h-[280px]">
        {segment.type === "say" && (
            <SaySegment
                label={segment.label}
                tokenMap={tokenMap}
                translateScript={translateScript}
            />
        )}
        {segment.type === "question" && (
            <QuestionSegment
                segment={segment}
                answer={answer}
                tokenMap={tokenMap}
                translateScript={translateScript}
                onChange={onAnswerChange}
                disabled={saving}
            />
        )}
        {segment.type === "instruction" && (
            <InstructionSegment
                label={segment.label}
                tokenMap={tokenMap}
                translateScript={translateScript}
            />
        )}
        {segment.type === "outcome" && (
            <OutcomeSegment
                label={segment.label}
                tokenMap={tokenMap}
                translateScript={translateScript}
                templateTree={templateTree}
                onComplete={onCompleteOutcomes}
                onOpenWebinarPicker={onOpenWebinarPicker}
                loading={completing}
            />
        )}
    </div>
);

export default SegmentCard;
