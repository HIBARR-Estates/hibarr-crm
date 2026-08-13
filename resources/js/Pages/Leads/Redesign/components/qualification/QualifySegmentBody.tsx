import type { Segment } from "@/Types/qualification";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import {
    useDynamicTranslation,
    useDynamicTranslations,
    useTd,
} from "@/Hooks/useDynamicTranslation";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import QualificationScriptHtml from "@/Pages/Leads/Components/Qualification/QualificationScriptHtml";
import {
    hasAnswerContent,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import DealSwitch from "@/Pages/Deals/Redesign/components/primitives/DealSwitch";
import RadioInput from "@/Pages/Deals/Redesign/components/analysis/inputs/RadioInput";
import CheckboxInput from "@/Pages/Deals/Redesign/components/analysis/inputs/CheckboxInput";
import SelectInput from "@/Pages/Deals/Redesign/components/analysis/inputs/SelectInput";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

interface QualifySegmentBodyProps {
    flow: QualificationFlow;
    currentSegment: Segment;
    agentLanguage: string;
    /** 1-based question number among walk questions (Analysis NumberBadge). */
    questionNumber?: number;
}

function NumberBadge({
    number,
    answered,
}: {
    number?: number;
    answered: boolean;
}) {
    return (
        <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-all"
            style={
                answered
                    ? {
                          backgroundColor: "#d1fae5",
                          color: "#065f46",
                          boxShadow: "0 0 0 2px #a7f3d0",
                      }
                    : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
            }
        >
            {answered ? (
                <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                    />
                </svg>
            ) : (
                number ?? "·"
            )}
        </div>
    );
}

function InstructionCard({
    text,
    translateScript,
}: {
    text: string;
    translateScript: (text: string) => string;
}) {
    const localized = useDynamicTranslation(text, { source: "en" });
    const html = translateScript(localized);

    return (
        <div
            className="flex items-start gap-2.5 rounded-md px-3 py-2.5 my-3 border border-amber-200"
            style={{ background: "#fffbeb" }}
        >
            <svg
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: "#d97706" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20A10 10 0 0112 2z"
                />
            </svg>
            <QualificationScriptHtml
                html={html}
                className="text-xs leading-relaxed flex-1"
            />
        </div>
    );
}

function ScriptBlock({
    text,
    translateScript,
}: {
    text: string;
    translateScript: (text: string) => string;
}) {
    const localized = useDynamicTranslation(text, { source: "en" });
    const translated = translateScript(localized);
    return (
        <QualificationScriptHtml
            html={translated}
            className="qualify-segment-prompt text-base font-normal mb-2 leading-snug"
            quoted
        />
    );
}

export default function QualifySegmentBody({
    flow,
    currentSegment,
    agentLanguage,
    questionNumber,
}: QualifySegmentBodyProps) {
    const { td } = useTd();

    const answer = flow.answers[currentSegment.key];
    const selectedValues = answer?.answer_values ?? [];
    const contextText = answer?.answer_text ?? "";
    const answered = hasAnswerContent(answer);

    const kind = currentSegment.type;
    const isQuestion = kind === "question";

    const rawOptions = currentSegment.options ?? [];
    const optionLabels = useDynamicTranslations(
        rawOptions.map((option) => stripHtmlTags(option.label) || option.label),
        { source: "en" },
    );
    const optionChoices = rawOptions.map((option, index) => ({
        value: option.id,
        label: optionLabels[index] ?? option.label,
    }));

    const patch = (values: string[], text?: string | null) => {
        flow.applyAnswerChange(currentSegment, values, text ?? null);
    };

    // Prefer SelectInput for long option lists (Analysis select fields);
    // RadioInput for shorter single-select (Analysis radio fields).
    const useSelect =
        currentSegment.answerType === "singleSelect" &&
        optionChoices.length > 6;

    return (
        <DynamicTranslationProvider locale={agentLanguage}>
            {kind === "instruction" ? (
                <InstructionCard
                    text={currentSegment.label}
                    translateScript={flow.translateScript}
                />
            ) : kind === "say" ? (
                <div className="mb-7">
                    <p
                        className="text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {td("Script", { source: "en" })}
                    </p>
                    <ScriptBlock
                        text={currentSegment.label}
                        translateScript={flow.translateScript}
                    />
                    <p
                        className="text-sm mt-2"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {td("Read this aloud to the lead.", { source: "en" })}
                    </p>
                </div>
            ) : isQuestion ? (
                <div className="flex gap-4 mb-7">
                    <NumberBadge number={questionNumber} answered={answered} />
                    <div className="flex-1 min-w-0">
                        <ScriptBlock
                            text={currentSegment.label}
                            translateScript={flow.translateScript}
                        />
                        <p
                            className="text-sm mb-3"
                            style={{ color: T.TEXT_MUTED }}
                        >
                            {td("Capture the lead's answer below.", {
                                source: "en",
                            })}
                            {currentSegment.required ? (
                                <span className="text-red-500 ml-1">*</span>
                            ) : null}
                        </p>

                        {currentSegment.answerType === "boolean" ? (
                            <DealSwitch
                                checked={
                                    selectedValues[0] === "true" ||
                                    selectedValues[0] === "yes"
                                }
                                label={
                                    selectedValues[0] === "true" ||
                                    selectedValues[0] === "yes"
                                        ? td("Yes", { source: "en" })
                                        : selectedValues[0] === "false" ||
                                            selectedValues[0] === "no"
                                          ? td("No", { source: "en" })
                                          : td("Toggle answer", {
                                                source: "en",
                                            })
                                }
                                onChange={() => {
                                    const next =
                                        selectedValues[0] === "true" ||
                                        selectedValues[0] === "yes"
                                            ? "false"
                                            : "true";
                                    patch([next], contextText || null);
                                }}
                            />
                        ) : null}

                        {currentSegment.answerType === "singleSelect" &&
                        useSelect ? (
                            <SelectInput
                                value={selectedValues[0] ?? ""}
                                options={optionChoices}
                                placeholder={td("Select an option", {
                                    source: "en",
                                })}
                                onChange={(value) =>
                                    patch([value], contextText || null)
                                }
                            />
                        ) : null}

                        {currentSegment.answerType === "singleSelect" &&
                        !useSelect ? (
                            <RadioInput
                                value={selectedValues[0] ?? ""}
                                options={optionChoices}
                                onChange={(value) =>
                                    patch([value], contextText || null)
                                }
                            />
                        ) : null}

                        {currentSegment.answerType === "multiSelect" ? (
                            <CheckboxInput
                                value={selectedValues}
                                options={optionChoices}
                                onChange={(values) =>
                                    patch(values, contextText || null)
                                }
                            />
                        ) : null}

                        {currentSegment.answerType === "text" ? (
                            <p
                                className="text-sm"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {td(
                                    "Use the answer field below the script to capture their response.",
                                    { source: "en" },
                                )}
                            </p>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </DynamicTranslationProvider>
    );
}
