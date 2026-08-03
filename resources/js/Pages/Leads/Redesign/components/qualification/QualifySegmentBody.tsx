import { useMemo, useState } from "react";
import type {
    QualificationOutcome,
    Segment,
} from "@/Types/qualification";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import WebinarSessionPickerModal from "@/Pages/Leads/Components/Qualification/WebinarSessionPickerModal";
import { RegistrationService } from "@/Services/RegistrationService";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

const OUTCOME_UI: Record<
    QualificationOutcome,
    { label: string; icon: string; className: string }
> = {
    bookMeeting: {
        label: "Book consultation",
        icon: "calendar",
        className: "v2-btn-primary",
    },
    inviteWebinar: {
        label: "Invite to webinar",
        icon: "video",
        className: "v2-btn-ghost",
    },
    callback: {
        label: "Schedule callback",
        icon: "refresh",
        className: "v2-btn-ghost",
    },
    noFit: {
        label: "Not a fit",
        icon: "x",
        className: "v2-btn-ghost",
    },
};

const GUIDANCE_BY_KIND: Record<string, string> = {
    say: "Read this aloud to the lead.",
    instruction: "Agent note — do not read aloud.",
    question: "Capture the lead's answer below.",
    outcome: "Choose the next action for this lead.",
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

    const answer = flow.answers[currentSegment.key];
    const selectedValues = answer?.answer_values ?? [];
    const contextText = answer?.answer_text ?? "";

    const kind = currentSegment.type;
    const isQuestion = kind === "question";
    const isOutcome = kind === "outcome";
    const showContextField =
        !isOutcome && currentSegment.answerType !== "text";

    const outcomeButtons = useMemo((): QualificationOutcome[] => {
        const outcomeType = currentSegment.outcomeMetadata?.type;
        if (outcomeType) return [outcomeType];
        return ["bookMeeting", "inviteWebinar", "callback", "noFit"];
    }, [currentSegment.outcomeMetadata?.type]);

    const handleWebinarSelect = async (
        sessionId: string,
        sessionLabel: string,
    ) => {
        setWebinarPickerOpen(false);
        await flow.completeWithOutcome("inviteWebinar", {
            webinarSessionId: sessionId,
            webinarSessionLabel: sessionLabel,
        });
    };

    const handleOutcome = async (
        outcome: QualificationOutcome,
        metadata?: { calendlyUrl?: string },
    ) => {
        await flow.completeWithOutcome(outcome, metadata);
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

                {isOutcome && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginBottom: 14,
                        }}
                    >
                        {outcomeButtons.map((outcome) => {
                            const ui = OUTCOME_UI[outcome];
                            const meta = currentSegment.outcomeMetadata;
                            return (
                                <button
                                    key={outcome}
                                    type="button"
                                    className={`v2-btn ${ui.className}`}
                                    disabled={flow.completing}
                                    onClick={() => {
                                        if (outcome === "inviteWebinar") {
                                            const webinarId = meta?.webinarId;
                                            if (!webinarId) {
                                                void handleOutcome(outcome);
                                                return;
                                            }
                                            setPendingWebinarId(webinarId);
                                            setWebinarPickerOpen(true);
                                            return;
                                        }
                                        void handleOutcome(outcome, {
                                            calendlyUrl: meta?.calendlyUrl,
                                        });
                                    }}
                                >
                                    <Icon name={ui.icon} size={14} />
                                    {meta?.label || td(ui.label)}
                                </button>
                            );
                        })}
                    </div>
                )}

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
                    onClose={() => setWebinarPickerOpen(false)}
                    onSelect={handleWebinarSelect}
                />
            ) : null}
        </DynamicTranslationProvider>
    );
}
