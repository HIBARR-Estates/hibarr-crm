import type { Segment, SegmentAnswerState } from "@/Types/qualification";
import { useTd, useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import {
    formatAnswerDisplay,
    hasAnswerContent,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { useTranslatedScriptLabel } from "@/Pages/Leads/Components/Qualification/useTranslatedScriptLabel";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";

interface QualifySegmentNavigatorProps {
    segments: Segment[];
    answers: Record<string, SegmentAnswerState>;
    currentSegmentKey?: string;
    onJump: (segmentKey: string) => void;
    /** Resolves `{{tokens}}` the same way the script body does. */
    translateScript: (text: string) => string;
    /** When true, omit the section title (parent rail provides tabs). */
    hideHeading?: boolean;
}

export default function QualifySegmentNavigator({
    segments,
    answers,
    currentSegmentKey,
    onJump,
    translateScript,
    hideHeading = false,
}: QualifySegmentNavigatorProps) {
    const { td } = useTd();

    return (
        <div
            className="qualify-nav-section flex flex-col h-full min-h-0"
            style={{ background: T.NAVY }}
        >
            {!hideHeading ? (
                <div className="px-4 pt-4 pb-3 shrink-0">
                    <p
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.85)" }}
                    >
                        {td("Script steps", { source: "en" })}
                    </p>
                </div>
            ) : null}

            <div className="flex-1 overflow-y-auto min-h-0 qualify-nav-dark">
                {segments.length === 0 ? (
                    <p
                        className="px-4 py-3 text-sm italic"
                        style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                        {td("No steps yet", { source: "en" })}
                    </p>
                ) : (
                    segments.map((segment) => (
                        <DarkNavItem
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

function DarkNavItem({
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
    const title = stripHtmlTags(translateScript(rawLabel)) || segment.key;
    const answered = hasAnswerContent(answer);
    const rawAnswer = formatAnswerDisplay(segment, answer);
    // The captured answer is the option label(s) — translate it like the question.
    const translatedAnswer = useDynamicTranslation(
        stripHtmlTags(rawAnswer) || rawAnswer,
        { source: "en" },
    );
    const answerText = translateScript(translatedAnswer);
    const context = answer?.answer_text?.trim() ?? "";
    const showContext =
        answered &&
        segment.type === "question" &&
        segment.answerType !== "text" &&
        Boolean(context) &&
        context !== answerText;
    const kind =
        segment.type === "say"
            ? td("Script", { source: "en" })
            : segment.type === "instruction"
              ? td("Note", { source: "en" })
              : td("Question", { source: "en" });

    return (
        <button
            type="button"
            onClick={() => onJump(segment.key)}
            className="w-full text-left py-3.5 pl-4 pr-3 transition-colors relative"
            style={{
                backgroundColor: isActive
                    ? "rgba(56, 189, 248, 0.22)"
                    : "transparent",
            }}
            onMouseEnter={(e) => {
                if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                        "rgba(255,255,255,0.08)";
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                        "transparent";
                }
            }}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1 transition-all"
                style={{
                    backgroundColor: isActive ? "#38bdf8" : "transparent",
                }}
            />
            <div
                className="text-[11px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: "rgba(255,255,255,0.72)" }}
            >
                {kind}
                {answered ? " · ✓" : ""}
            </div>
            <div
                className="text-[15px] font-semibold leading-snug line-clamp-2"
                style={{ color: "#ffffff" }}
            >
                {title}
            </div>
            {answered && segment.type === "question" && answerText ? (
                <div
                    className="mt-2.5 rounded-md px-3 py-2"
                    style={{
                        background: "#0c4a6e",
                        border: "1px solid #38bdf8",
                    }}
                >
                    <div
                        className="text-[11px] font-bold uppercase tracking-widest mb-1"
                        style={{ color: "#7dd3fc" }}
                    >
                        {td("Answer", { source: "en" })}
                    </div>
                    <div
                        className="text-[15px] font-bold leading-snug line-clamp-3"
                        style={{ color: "#ffffff" }}
                    >
                        {answerText}
                    </div>
                    {showContext ? (
                        <div
                            className="mt-1.5 text-[13px] leading-snug line-clamp-2"
                            style={{ color: "rgba(255,255,255,0.85)" }}
                        >
                            {context}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </button>
    );
}
