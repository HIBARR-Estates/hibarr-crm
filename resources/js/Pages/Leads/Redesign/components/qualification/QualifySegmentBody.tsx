import { useMemo } from "react";
import type {
    LeadQualification,
    QualificationOutcome,
    Segment,
} from "@/Types/qualification";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import OutcomeMultiSelect from "@/Pages/Leads/Components/Qualification/OutcomeMultiSelect";
import { getScriptOutcomes } from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

const GUIDANCE_BY_KIND: Record<string, string> = {
    say: "Read this aloud to the lead.",
    instruction: "Agent note — do not read aloud.",
    question: "Capture the lead's answer below.",
    outcome: "Select one or more outcomes for this lead.",
};

interface ScriptPromptProps {
    text: string;
    kind: string;
    translateScript: (text: string) => string;
}

function ScriptPrompt({ text, kind, translateScript }: ScriptPromptProps) {
    const localized = useDynamicTranslation(text, { source: "en" });
    const translated = translateScript(localized);
    const quoted = kind === "say" || kind === "question";

    return (
        <p className="v2-qualify-prompt">
            {quoted ? `“${translated}”` : translated}
        </p>
    );
}

interface QualifySegmentBodyProps {
    flow: QualificationFlow;
    currentSegment: Segment;
    agentLanguage: string;
    onCompletedWithActions?: (qualification: LeadQualification) => void;
}

export default function QualifySegmentBody({
    flow,
    currentSegment,
    agentLanguage,
    onCompletedWithActions,
}: QualifySegmentBodyProps) {
    const { td } = useTd();

    const answer = flow.answers[currentSegment.key];
    const selectedValues = answer?.answer_values ?? [];
    const contextText = answer?.answer_text ?? "";

    const kind = currentSegment.type;
    const isQuestion = kind === "question";
    const isOutcome = kind === "outcome";
    const showContextField =
        !isOutcome && currentSegment.answerType !== "text";

    const scriptOutcomes = useMemo(
        () => getScriptOutcomes(flow.templateTree),
        [flow.templateTree],
    );

    const handleOutcomeConfirm = async (
        outcomes: QualificationOutcome[],
        comment: string | null,
    ) => {
        const updated = await flow.completeWithOutcomes(outcomes, { comment });
        if (updated) {
            onCompletedWithActions?.(updated);
        }
    };

    const toggleMulti = (optionId: string) => {
        const selected = selectedValues.includes(optionId);
        const next = selected
            ? selectedValues.filter((id) => id !== optionId)
            : [...selectedValues, optionId];
        void flow.applyAnswerChange(currentSegment, next, contextText || null);
    };

    return (
        <DynamicTranslationProvider locale={agentLanguage}>
            <div>
                {(kind === "say" ||
                    kind === "instruction" ||
                    isQuestion ||
                    isOutcome) && (
                    <>
                        <ScriptPrompt
                            text={currentSegment.label}
                            kind={kind}
                            translateScript={flow.translateScript}
                        />
                        <p className="v2-qualify-guidance">
                            {td(GUIDANCE_BY_KIND[kind] ?? GUIDANCE_BY_KIND.question, { source: "en" })}
                        </p>
                    </>
                )}

                {isQuestion && currentSegment.answerType === "text" && (
                    <textarea
                        className="v2-input"
                        value={contextText}
                        onChange={(e) =>
                            void flow.applyAnswerChange(
                                currentSegment,
                                [],
                                e.target.value,
                            )
                        }
                        disabled={flow.saving}
                        rows={4}
                        placeholder={td("Type the answer...", { source: "en" })}
                        style={{ marginBottom: 14 }}
                    />
                )}

                {isQuestion && currentSegment.answerType === "boolean" && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginBottom: 14,
                        }}
                    >
                        {(["yes", "no"] as const).map((value) => {
                            const selected = selectedValues[0] === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className={`v2-option${
                                        selected ? " selected" : ""
                                    }`}
                                    disabled={flow.saving}
                                    onClick={() =>
                                        void flow.applyAnswerChange(
                                            currentSegment,
                                            [value],
                                            contextText || null,
                                        )
                                    }
                                >
                                    <span>
                                        {value === "yes" ? td("Yes", { source: "en" }) : td("No", { source: "en" })}
                                    </span>
                                    {selected ? (
                                        <Icon name="check" size={16} />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                )}

                {isQuestion &&
                    (currentSegment.answerType === "singleSelect" ||
                        currentSegment.answerType === "multiSelect") && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                marginBottom: 14,
                            }}
                        >
                            {(currentSegment.options ?? []).map((option) => {
                                const selected = selectedValues.includes(
                                    option.id,
                                );
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`v2-option${
                                            selected ? " selected" : ""
                                        }`}
                                        disabled={flow.saving}
                                        onClick={() => {
                                            if (
                                                currentSegment.answerType ===
                                                "multiSelect"
                                            ) {
                                                toggleMulti(option.id);
                                                return;
                                            }
                                            void flow.applyAnswerChange(
                                                currentSegment,
                                                [option.id],
                                                contextText || null,
                                            );
                                        }}
                                    >
                                        <span>{option.label}</span>
                                        {selected ? (
                                            <Icon name="check" size={16} />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                {isOutcome ? (
                    <OutcomeMultiSelect
                        options={scriptOutcomes}
                        variant="redesign"
                        completing={flow.completing}
                        onConfirm={(outcomes, comment) =>
                            handleOutcomeConfirm(outcomes, comment)
                        }
                    />
                ) : null}

                {showContextField ? (
                    <input
                        className="v2-input"
                        value={contextText}
                        onChange={(e) =>
                            void flow.applyAnswerChange(
                                currentSegment,
                                selectedValues,
                                e.target.value,
                            )
                        }
                        disabled={flow.saving}
                        placeholder={td("Add context for this answer...", { source: "en" })}
                    />
                ) : null}
            </div>
        </DynamicTranslationProvider>
    );
}
