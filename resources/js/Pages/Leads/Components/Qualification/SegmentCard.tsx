import React from "react";
import { Segment, QualificationToken } from "@/Types/qualification";
import { SegmentAnswerState } from "@/Types/qualification";
import SaySegment from "./segments/SaySegment";
import QuestionSegment from "./segments/QuestionSegment";
import InstructionSegment from "./segments/InstructionSegment";
import OutcomeSegment from "./segments/OutcomeSegment";
import { QualificationOutcome } from "@/Types/qualification";

interface SegmentCardProps {
    segment: Segment;
    answer?: SegmentAnswerState;
    tokenMap: Record<QualificationToken, string>;
    translateScript: (text: string) => string;
    onAnswerChange: (values: string[], text?: string | null) => void;
    onOutcome: (
        outcome: QualificationOutcome,
        metadata?: { webinarSessionId?: string; calendlyUrl?: string },
    ) => Promise<void>;
    onOpenWebinarPicker?: (webinarId: string) => void;
    saving?: boolean;
    completing?: boolean;
}

const SegmentCard: React.FC<SegmentCardProps> = ({
    segment,
    answer,
    tokenMap,
    translateScript,
    onAnswerChange,
    onOutcome,
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
                outcomeMetadata={segment.outcomeMetadata}
                tokenMap={tokenMap}
                translateScript={translateScript}
                onOutcome={onOutcome}
                onOpenWebinarPicker={onOpenWebinarPicker}
                loading={completing}
            />
        )}
    </div>
);

export default SegmentCard;
