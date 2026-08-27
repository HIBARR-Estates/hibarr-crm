import type { Segment, SegmentAnswerState } from "@/Types/qualification";
import { useTd, useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import {
    formatAnswerDisplay,
    hasAnswerContent,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { useTranslatedScriptLabel } from "@/Pages/Leads/Components/Qualification/useTranslatedScriptLabel";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";

interface QualifyAnswersPanelProps {
    segments: Segment[];
    answers: Record<string, SegmentAnswerState>;
    currentSegmentKey?: string;
    onJump: (segmentKey: string) => void;
    /** Resolves `{{tokens}}` the same way the script body does. */
    translateScript: (text: string) => string;
    /** When true, omit the section title (parent rail provides tabs). */
    hideHeading?: boolean;
}

export default function QualifyAnswersPanel({
    segments,
    answers,
    currentSegmentKey,
    onJump,
    translateScript,
    hideHeading = false,
}: QualifyAnswersPanelProps) {
    const { td } = useTd();

    const answered = segments.filter(
        (segment) =>
            segment.type === "question" &&
            hasAnswerContent(answers[segment.key]),
    );

    return (
        <div
            className="qualify-answers-section flex flex-col h-full min-h-0"
            style={{ background: T.SURFACE }}
        >
            {!hideHeading ? (
                <div
                    className="px-4 pt-4 pb-3 shrink-0"
                    style={{ borderBottom: `1px solid ${T.BORDER}` }}
                >
                    <p
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: T.TEXT }}
                    >
                        {td("Captured answers", { source: "en" })}
                    </p>
                </div>
            ) : null}

            <div className="flex-1 overflow-y-auto min-h-0">
                {answered.length === 0 ? (
                    <p
                        className="px-4 py-3 text-sm"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {td("Answers will appear here as you capture them.", {
                            source: "en",
                        })}
                    </p>
                ) : (
                    answered.map((segment) => (
                        <AnswerCard
                            key={segment.key}
                            segment={segment}
                            answer={answers[segment.key]}
                            isActive={segment.key === currentSegmentKey}
                            onJump={onJump}
                            translateScript={translateScript}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function AnswerCard({
    segment,
    answer,
    isActive,
    onJump,
    translateScript,
}: {
    segment: Segment;
    answer?: SegmentAnswerState;
    isActive: boolean;
    onJump: (key: string) => void;
    translateScript: (text: string) => string;
}) {
    const { td } = useTd();
    const rawLabel = useTranslatedScriptLabel(segment.label || segment.key);
    const question = stripHtmlTags(translateScript(rawLabel)) || segment.key;
    const rawAnswer = formatAnswerDisplay(segment, answer);
    // The captured answer is the option label(s) — translate it like the question.
    const translatedAnswer = useDynamicTranslation(
        stripHtmlTags(rawAnswer) || rawAnswer,
        { source: "en" },
    );
    const answerText = translateScript(translatedAnswer);
    const context = answer?.answer_text?.trim() ?? "";
    const showContext =
        Boolean(context) &&
        segment.answerType !== "text" &&
        context !== answerText;

    return (
        <button
            type="button"
            onClick={() => onJump(segment.key)}
            className="w-full text-left px-4 py-3.5 transition-colors relative border-b"
            style={{
                borderColor: T.BORDER,
                backgroundColor: isActive ? T.BLUE_LIGHT : "#ffffff",
            }}
            onMouseEnter={(e) => {
                if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                        T.SURFACE_2;
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                        "#ffffff";
                }
            }}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{
                    backgroundColor: isActive ? "#38bdf8" : "transparent",
                }}
            />
            <p
                className="text-[13px] font-medium leading-snug line-clamp-2 mb-2"
                style={{ color: T.TEXT }}
            >
                {question}
            </p>
            <div
                className="rounded-md px-3 py-2"
                style={{
                    background: isActive ? "#dbeafe" : "#f1f5f9",
                    border: `1px solid ${isActive ? "#7dd3fc" : T.BORDER}`,
                }}
            >
                <div
                    className="text-[11px] font-bold uppercase tracking-widest mb-1"
                    style={{ color: T.NAVY }}
                >
                    {td("Answer", { source: "en" })}
                </div>
                <p
                    className="text-[15px] font-bold leading-snug break-words"
                    style={{ color: T.TEXT }}
                >
                    {answerText || "—"}
                </p>
                {showContext ? (
                    <p
                        className="mt-1.5 text-[13px] leading-snug line-clamp-3"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {context}
                    </p>
                ) : null}
            </div>
        </button>
    );
}
