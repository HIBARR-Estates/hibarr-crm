import { useMemo, useState } from "react";
import type { Lead } from "@/Types/api/leads";
import type {
    LeadQualification,
    QualificationOutcome,
    TemplateTree,
} from "@/Types/qualification";
import { LeadQualificationService } from "@/Services/LeadQualificationService";
import { RegistrationService } from "@/Services/RegistrationService";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useDynamicTranslation } from "@/Hooks/useDynamicTranslation";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import BranchChangeWarningModal from "@/Pages/Leads/Components/Qualification/BranchChangeWarningModal";
import WebinarSessionPickerModal from "@/Pages/Leads/Components/Qualification/WebinarSessionPickerModal";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import LeadIcon from "../../primitives/LeadIcon";
import { LEAD_REDESIGN_TOKENS as T } from "../../../types";
import { useTd } from "@/Hooks/useDynamicTranslation";

const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "de", label: "German" },
    { value: "tr", label: "Turkish" },
    { value: "ru", label: "Russian" },
];

const OUTCOME_UI: Record<
    QualificationOutcome,
    { label: string; icon: string; variant: "primary" | "secondary" | "danger" }
> = {
    bookMeeting: {
        label: "Book consultation",
        icon: "calendar",
        variant: "primary",
    },
    inviteWebinar: {
        label: "Invite to webinar",
        icon: "video",
        variant: "secondary",
    },
    callback: {
        label: "Schedule callback",
        icon: "refresh",
        variant: "secondary",
    },
    noFit: { label: "Not a fit", icon: "x", variant: "danger" },
};

const STEP_KIND_LABEL: Record<string, string> = {
    say: "Read aloud",
    question: "Ask",
    instruction: "Note",
    outcome: "Close",
};

interface QualificationScriptFlowProps {
    lead: Lead;
    qualification: LeadQualification;
    templateTree: TemplateTree;
    qualificationService: LeadQualificationService;
    registrationService: RegistrationService;
    onQualificationUpdated: (qualification: LeadQualification) => void;
    onAbandoned: () => void;
}

function ScriptPrompt({
    text,
    kind,
    translateScript,
}: {
    text: string;
    kind: string;
    translateScript: (text: string) => string;
}) {
    const localized = useDynamicTranslation(text);
    const translated = translateScript(localized);
    return (
        <p
            style={{
                fontSize: kind === "say" ? 18 : 16,
                lineHeight: 1.45,
                color: T.NAVY,
                margin: 0,
            }}
        >
            {translated}
        </p>
    );
}

export default function QualificationScriptFlow({
    lead,
    qualification,
    templateTree,
    qualificationService,
    registrationService,
    onQualificationUpdated,
    onAbandoned,
}: QualificationScriptFlowProps) {
    const { td } = useTd();
    const [agentLanguage, setAgentLanguage] = useState(
        qualification.agent_language || "en",
    );
    const [webinarPickerOpen, setWebinarPickerOpen] = useState(false);
    const [pendingWebinarId, setPendingWebinarId] = useState<string | null>(
        null,
    );

    const flow = useQualificationFlow({
        lead,
        qualification,
        templateTree,
        service: qualificationService,
        registrationService,
        agentLanguage,
        onQualificationUpdated,
    });

    const segment = flow.currentSegment;
    const progress = useMemo(() => {
        const total = Math.max(flow.visibleSegments.length, 1);
        const current = Math.max(flow.currentIndex, 0) + 1;
        return Math.min(100, Math.round((current / total) * 100));
    }, [flow.currentIndex, flow.visibleSegments.length]);

    const kind = segment?.type ?? "question";
    const answer = segment ? flow.answers[segment.key] : undefined;
    const selectedValues = answer?.answer_values ?? [];
    const isOutcome = kind === "outcome";
    const showNav = !isOutcome;

    const handleOutcome = async (
        outcome: QualificationOutcome,
        metadata?: { webinarSessionId?: string; calendlyUrl?: string },
    ) => {
        await flow.completeWithOutcome(outcome, metadata);
    };

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

    const handleAbandon = async () => {
        await flow.abandon();
        onAbandoned();
    };

    const outcomeType = segment?.outcomeMetadata?.type;
    const outcomeButtons: QualificationOutcome[] = outcomeType
        ? [outcomeType]
        : (["bookMeeting", "inviteWebinar", "callback", "noFit"] as const);

    return (
        <DynamicTranslationProvider locale={agentLanguage}>
            <div style={{ display: "grid", gap: 14 }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <select
                        value={agentLanguage}
                        onChange={(e) => setAgentLanguage(e.target.value)}
                        style={{
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 6,
                            padding: "5px 8px",
                            fontSize: 12,
                            outline: "none",
                            background: T.WHITE,
                        }}
                    >
                        {LANGUAGE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <DealButton
                        variant="ghost"
                        onClick={() => void handleAbandon()}
                        loading={flow.completing}
                        style={{ fontSize: 11, color: "#b91c1c" }}
                    >
                        {td("Abandon")}
                    </DealButton>
                </div>

                <div
                    style={{
                        height: 4,
                        background: T.GRAY_MID,
                        borderRadius: 4,
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${progress}%`,
                            height: "100%",
                            background: T.BLUE,
                            transition: "width 0.2s ease",
                        }}
                    />
                </div>

                {segment && (
                    <div
                        style={{
                            border: `1.5px solid ${
                                isOutcome ? T.BLUE_MID : T.BORDER
                            }`,
                            borderRadius: 10,
                            padding: "14px 16px",
                            background: kind === "say" ? "#f0f6fd" : T.WHITE,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: T.BLUE,
                                textTransform: "uppercase",
                                letterSpacing: "0.07em",
                                marginBottom: 8,
                            }}
                        >
                            {STEP_KIND_LABEL[kind] ?? kind}
                        </div>
                        <ScriptPrompt
                            text={segment.label}
                            kind={kind}
                            translateScript={flow.translateScript}
                        />
                    </div>
                )}

                {segment?.type === "question" &&
                    (segment.answerType === "text" ? (
                        <textarea
                            value={answer?.answer_text ?? ""}
                            onChange={(e) =>
                                void flow.applyAnswerChange(
                                    segment,
                                    [],
                                    e.target.value,
                                )
                            }
                            disabled={flow.saving}
                            rows={3}
                            style={{
                                width: "100%",
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: 8,
                                padding: "9px 11px",
                                fontSize: 13,
                                outline: "none",
                                resize: "vertical",
                            }}
                            placeholder={td("Type the answer...")}
                        />
                    ) : segment.answerType === "boolean" ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {["yes", "no"].map((value) => {
                                const selected = selectedValues[0] === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`response-chip${
                                            selected
                                                ? value === "yes"
                                                    ? " selected-yes"
                                                    : " selected"
                                                : ""
                                        }`}
                                        disabled={flow.saving}
                                        onClick={() =>
                                            void flow.applyAnswerChange(
                                                segment,
                                                [value],
                                            )
                                        }
                                    >
                                        {value === "yes" ? td("Yes") : td("No")}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {(segment.options ?? []).map((option) => {
                                const selected = selectedValues.includes(
                                    option.id,
                                );
                                const yesLike = /yes|true|fit/i.test(
                                    option.label,
                                );
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`response-chip${
                                            selected
                                                ? yesLike
                                                    ? " selected-yes"
                                                    : " selected"
                                                : ""
                                        }`}
                                        disabled={flow.saving}
                                        onClick={() => {
                                            if (
                                                segment.answerType ===
                                                "multiSelect"
                                            ) {
                                                const next = selected
                                                    ? selectedValues.filter(
                                                          (id) =>
                                                              id !== option.id,
                                                      )
                                                    : [
                                                          ...selectedValues,
                                                          option.id,
                                                      ];
                                                void flow.applyAnswerChange(
                                                    segment,
                                                    next,
                                                );
                                            } else {
                                                void flow.applyAnswerChange(
                                                    segment,
                                                    [option.id],
                                                );
                                            }
                                        }}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    ))}

                {isOutcome && (
                    <div style={{ display: "grid", gap: 7 }}>
                        {outcomeButtons.map((outcome) => {
                            const ui = OUTCOME_UI[outcome];
                            const meta = segment?.outcomeMetadata;
                            return (
                                <button
                                    key={outcome}
                                    type="button"
                                    className={`outcome-btn outcome-${ui.variant}`}
                                    disabled={flow.completing}
                                    onClick={() => {
                                        if (outcome === "inviteWebinar") {
                                            const webinarId =
                                                meta?.webinarId ??
                                                segment?.outcomeMetadata
                                                    ?.webinarId;
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
                                    {ui.icon === "x" ? (
                                        <span>✕</span>
                                    ) : (
                                        <LeadIcon name={ui.icon} size={14} />
                                    )}
                                    {meta?.label || ui.label}
                                </button>
                            );
                        })}
                    </div>
                )}

                {showNav && (
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                        }}
                    >
                        <DealButton
                            variant="ghost"
                            disabled={!flow.canGoBack || flow.saving}
                            onClick={() => void flow.goBack()}
                            style={{
                                opacity: !flow.canGoBack ? 0.4 : 1,
                            }}
                        >
                            ← {td("Back")}
                        </DealButton>
                        <DealButton
                            variant="primary"
                            disabled={
                                flow.isLastSegment ||
                                flow.saving ||
                                Boolean(flow.validationError)
                            }
                            loading={flow.saving}
                            onClick={() => void flow.goNext()}
                            style={{
                                fontSize: 13,
                                padding: "8px 14px",
                                opacity:
                                    flow.isLastSegment ||
                                    Boolean(flow.validationError)
                                        ? 0.4
                                        : 1,
                            }}
                        >
                            {td("Next")} →
                        </DealButton>
                    </div>
                )}
            </div>

            <BranchChangeWarningModal
                open={Boolean(flow.branchChangePending)}
                onConfirm={() => void flow.confirmBranchChange()}
                onCancel={flow.cancelBranchChange}
                loading={flow.saving}
            />

            {pendingWebinarId && (
                <WebinarSessionPickerModal
                    open={webinarPickerOpen}
                    webinarId={pendingWebinarId}
                    registrationService={registrationService}
                    onClose={() => setWebinarPickerOpen(false)}
                    onSelect={handleWebinarSelect}
                />
            )}
        </DynamicTranslationProvider>
    );
}
