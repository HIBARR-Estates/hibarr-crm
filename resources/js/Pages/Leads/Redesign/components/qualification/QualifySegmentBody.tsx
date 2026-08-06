import { useMemo, useState } from "react";
import type { Segment } from "@/Types/qualification";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import WebinarSessionPickerModal from "@/Pages/Leads/Components/Qualification/WebinarSessionPickerModal";
import OutcomeMultiSelect from "@/Pages/Leads/Components/Qualification/OutcomeMultiSelect";
import {
    getScriptOutcomes,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { RegistrationService } from "@/Services/RegistrationService";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import type { QualificationOutcome } from "@/Types/qualification";

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
    const localized = useDynamicTranslation(text);
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
    registrationService: RegistrationService;
    agentLanguage: string;
}

export default function QualifySegmentBody({
    flow,
    currentSegment,
    registrationService,
    agentLanguage,
}: QualifySegmentBodyProps) {
    const { td } = useTd();
    const [webinarPickerOpen, setWebinarPickerOpen] = useState(false);
    const [pendingWebinarId, setPendingWebinarId] = useState<string | null>(
        null,
    );
    const [pendingComplete, setPendingComplete] = useState<{
        outcomes: QualificationOutcome[];
        comment: string | null;
        calendlyUrl?: string;
    } | null>(null);

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

    const handleWebinarSelect = async (
        sessionId: string,
        sessionLabel: string,
    ) => {
        if (!pendingComplete) return;
        setWebinarPickerOpen(false);
        try {
            await flow.completeWithOutcomes(pendingComplete.outcomes, {
                comment: pendingComplete.comment,
                webinarSessionId: sessionId,
                webinarSessionLabel: sessionLabel,
                calendlyUrl: pendingComplete.calendlyUrl,
            });
        } finally {
            setPendingComplete(null);
            setPendingWebinarId(null);
        }
    };

    const handleOutcomeConfirm = async (
        outcomes: QualificationOutcome[],
        comment: string | null,
        meta: { calendlyUrl?: string; webinarId?: string },
    ) => {
        if (outcomes.includes("inviteWebinar")) {
            const webinarId =
                meta.webinarId ||
                scriptOutcomes.find((o) => o.key === "inviteWebinar")
                    ?.webinarId;
            if (webinarId) {
                setPendingComplete({
                    outcomes,
                    comment,
                    calendlyUrl: meta.calendlyUrl,
                });
                setPendingWebinarId(webinarId);
                setWebinarPickerOpen(true);
                return;
            }
        }

        await flow.completeWithOutcomes(outcomes, {
            comment,
            calendlyUrl: meta.calendlyUrl,
        });
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
                            {td(GUIDANCE_BY_KIND[kind] ?? GUIDANCE_BY_KIND.question)}
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
                        placeholder={td("Type the answer...")}
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
                                        {value === "yes" ? td("Yes") : td("No")}
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
                        onConfirm={handleOutcomeConfirm}
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
                        placeholder={td("Add context for this answer...")}
                    />
                ) : null}
            </div>

            {pendingWebinarId ? (
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
            ) : null}
        </DynamicTranslationProvider>
    );
}
