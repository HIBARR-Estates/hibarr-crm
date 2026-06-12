import React from "react";
import { Tag } from "antd";
import {
    Segment,
    SegmentAnswerState,
} from "@/Types/qualification";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";

interface CaptureSummaryRailProps {
    visibleSegments: Segment[];
    answers: Record<string, SegmentAnswerState>;
    currentSegmentKey?: string;
}

const CaptureSummaryRail: React.FC<CaptureSummaryRailProps> = ({
    visibleSegments,
    answers,
    currentSegmentKey,
}) => {
    const questionSegments = visibleSegments.filter(
        (s) => s.type === "question",
    );

    if (questionSegments.length === 0) {
        return null;
    }

    return (
        <aside className="w-72 shrink-0 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Captured answers
            </h3>
            <div className="space-y-3">
                {questionSegments.map((segment) => (
                    <AnswerChip
                        key={segment.key}
                        segment={segment}
                        answer={answers[segment.key]}
                        isActive={segment.key === currentSegmentKey}
                    />
                ))}
            </div>
        </aside>
    );
};

const AnswerChip: React.FC<{
    segment: Segment;
    answer?: SegmentAnswerState;
    isActive: boolean;
}> = ({ segment, answer, isActive }) => {
    const labelTranslated = useDynamicTranslation(segment.label);
    const display = resolveDisplay(segment, answer);

    return (
        <div
            className={`rounded-lg p-3 text-sm ${
                isActive
                    ? "bg-blue-50 border border-blue-200"
                    : "bg-white border border-gray-200"
            }`}
        >
            <p className="text-gray-500 text-xs mb-1 line-clamp-2">
                {labelTranslated}
            </p>
            {display ? (
                <Tag color="blue" className="m-0 max-w-full truncate">
                    {display}
                </Tag>
            ) : (
                <span className="text-gray-400 italic text-xs">Pending</span>
            )}
        </div>
    );
};

const resolveDisplay = (
    segment: Segment,
    answer?: SegmentAnswerState,
): string | null => {
    if (!answer) return null;

    if (segment.answerType === "text") {
        return answer.answer_text?.trim() || null;
    }

    if (segment.answerType === "boolean") {
        return answer.answer_values[0] === "true" ? "Yes" : "No";
    }

    const labels = (segment.options ?? [])
        .filter((o) => answer.answer_values.includes(o.id))
        .map((o) => o.label);

    return labels.length ? labels.join(", ") : null;
};

export default CaptureSummaryRail;
