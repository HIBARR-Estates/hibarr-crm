import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useDynamicTranslation, useTd } from "@/Hooks/useDynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import QualificationScriptHtml from "@/Pages/Leads/Components/Qualification/QualificationScriptHtml";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import WebinarSessionPickerModal from "@/Pages/Leads/Components/Qualification/WebinarSessionPickerModal";
import {
    FALLBACK_OUTCOME_BODIES,
    FALLBACK_OUTCOME_CTA,
    findOutcomeSegment,
    getAllOutcomeChoices,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { DEFAULT_OUTCOME_LABELS } from "@/Types/qualification";
import type {
    LeadQualification,
    QualificationActionRun,
    QualificationOutcome,
} from "@/Types/qualification";
import type { Lead } from "@/Types/api/leads";
import { LeadQualificationService } from "@/Services/LeadQualificationService";
import { RegistrationService } from "@/Services/RegistrationService";
import RadioInput from "@/Pages/Deals/Redesign/components/analysis/inputs/RadioInput";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";
import { message } from "antd";
import { useMemo, useState } from "react";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

const NO_OP = new Set(["schedule_callback", "mark_no_fit"]);

const OUTCOME_CARD_META: Record<
    QualificationOutcome,
    {
        icon: string;
        iconBg: string;
        iconColor: string;
        description: string;
    }
> = {
    bookMeeting: {
        icon: "calendar",
        iconBg: "#e8f1fb",
        iconColor: T.NAVY,
        description: "Arrange a consultation with a specialist.",
    },
    inviteWebinar: {
        icon: "video",
        iconBg: "#ecfdf5",
        iconColor: "#047857",
        description: "Invite the lead to an upcoming webinar.",
    },
    callback: {
        icon: "phone",
        iconBg: "#fff7ed",
        iconColor: "#c2410c",
        description: "Schedule a callback for a better time.",
    },
    noFit: {
        icon: "ban",
        iconBg: "#fef2f2",
        iconColor: "#b91c1c",
        description: "Close out — not the right fit right now.",
    },
};

const splitLeadName = (name?: string | null) => {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
};

function NumberBadge({
    number,
    answered,
}: {
    number?: number | string;
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

function AnalysisTextarea({
    value,
    onChange,
    placeholder,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={3}
            className="w-full resize-y rounded-xl px-3 py-2 text-sm placeholder-slate-400 focus:outline-none transition-colors disabled:opacity-50"
            style={{
                border: `1px solid ${T.BORDER}`,
                color: T.TEXT,
                fontFamily: "inherit",
                background: "#f8fafc",
                minHeight: 72,
            }}
            onFocus={(e) => {
                e.target.style.borderColor = "#38bdf8";
                e.target.style.boxShadow = "0 0 0 2px #e0f2fe";
                e.target.style.background = "#fff";
            }}
            onBlur={(e) => {
                e.target.style.borderColor = T.BORDER;
                e.target.style.boxShadow = "none";
                e.target.style.background = "#f8fafc";
            }}
        />
    );
}

function OutcomeFooter({
    onBack,
    onPrimary,
    backLabel,
    primaryLabel,
    primaryDisabled,
}: {
    onBack: () => void;
    onPrimary?: () => void;
    backLabel: string;
    primaryLabel?: string;
    primaryDisabled?: boolean;
}) {
    return (
        <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-3 bg-white border-t border-slate-200">
            <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-600 cursor-pointer transition-colors hover:bg-slate-50"
            >
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
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
                {backLabel}
            </button>

            {onPrimary && primaryLabel ? (
                <button
                    type="button"
                    onClick={onPrimary}
                    disabled={primaryDisabled}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#0A2E5D" }}
                >
                    {primaryLabel}
                </button>
            ) : (
                <span />
            )}
        </div>
    );
}

function OutcomeChoiceCards({
    choices,
    onSelect,
}: {
    choices: Array<{ key: QualificationOutcome; label: string }>;
    onSelect: (outcome: QualificationOutcome) => void;
}) {
    const { td } = useTd();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {choices.map((choice) => {
                const meta = OUTCOME_CARD_META[choice.key];
                return (
                    <button
                        key={choice.key}
                        type="button"
                        onClick={() => onSelect(choice.key)}
                        className="group text-left rounded-xl p-4 transition-all cursor-pointer"
                        style={{
                            background: "#fff",
                            border: `1.5px solid ${T.BORDER}`,
                            boxShadow: "0 1px 2px rgba(22, 41, 77, 0.04)",
                        }}
                        onMouseEnter={(e) => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.borderColor = T.NAVY;
                            el.style.boxShadow =
                                "0 4px 14px rgba(22, 41, 77, 0.12)";
                            el.style.background = T.BLUE_LIGHT;
                        }}
                        onMouseLeave={(e) => {
                            const el = e.currentTarget as HTMLElement;
                            el.style.borderColor = T.BORDER;
                            el.style.boxShadow =
                                "0 1px 2px rgba(22, 41, 77, 0.04)";
                            el.style.background = "#fff";
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: meta.iconBg,
                                    color: meta.iconColor,
                                }}
                            >
                                <Icon name={meta.icon} size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <p
                                        className="text-[15px] font-semibold leading-snug"
                                        style={{ color: T.TEXT }}
                                    >
                                        {td(choice.label, { source: "en" })}
                                    </p>
                                    <Icon
                                        name="chevron-right"
                                        size={16}
                                        className="shrink-0 opacity-40 group-hover:opacity-80"
                                    />
                                </div>
                                <p
                                    className="mt-1 text-[13px] leading-snug"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {td(meta.description, { source: "en" })}
                                </p>
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

interface QualifyOutcomePhaseProps {
    flow: QualificationFlow;
    lead: Lead;
    agentLanguage: string;
    qualificationService: LeadQualificationService;
    registrationService: RegistrationService;
    selectedOutcome: QualificationOutcome | null;
    onSelectOutcome: (outcome: QualificationOutcome) => void;
    onBack: () => void;
    onCompleted: (qualification: LeadQualification) => void;
    onDone: (qualification: LeadQualification) => void;
}

export default function QualifyOutcomePhase({
    flow,
    lead,
    agentLanguage,
    qualificationService,
    registrationService,
    selectedOutcome,
    onSelectOutcome,
    onBack,
    onCompleted,
    onDone,
}: QualifyOutcomePhaseProps) {
    const { td } = useTd();
    const choices = useMemo(
        () => getAllOutcomeChoices(flow.templateTree),
        [flow.templateTree],
    );

    if (!selectedOutcome) {
        return (
            <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-4">
                    <div className="flex gap-4 mb-7">
                        <NumberBadge number="★" answered={false} />
                        <div className="flex-1 min-w-0">
                            <p
                                className="text-base font-semibold mb-2 leading-snug"
                                style={{ color: T.TEXT }}
                            >
                                {td("Choose an outcome", { source: "en" })}
                            </p>
                            <p
                                className="text-sm mb-4"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {td(
                                    "Select how this qualification should finish based on the call.",
                                    { source: "en" },
                                )}
                            </p>
                            <OutcomeChoiceCards
                                choices={choices}
                                onSelect={onSelectOutcome}
                            />
                        </div>
                    </div>
                </div>
                <OutcomeFooter
                    onBack={onBack}
                    backLabel={td("Previous", { source: "en" })}
                />
            </div>
        );
    }

    return (
        <OutcomeDetail
            flow={flow}
            lead={lead}
            agentLanguage={agentLanguage}
            outcome={selectedOutcome}
            qualificationService={qualificationService}
            registrationService={registrationService}
            onBack={onBack}
            onCompleted={onCompleted}
            onDone={onDone}
        />
    );
}

function OutcomeDetail({
    flow,
    lead,
    agentLanguage,
    outcome,
    qualificationService,
    registrationService,
    onBack,
    onCompleted,
    onDone,
}: {
    flow: QualificationFlow;
    lead: Lead;
    agentLanguage: string;
    outcome: QualificationOutcome;
    qualificationService: LeadQualificationService;
    registrationService: RegistrationService;
    onBack: () => void;
    onCompleted: (qualification: LeadQualification) => void;
    onDone: (qualification: LeadQualification) => void;
}) {
    const { td } = useTd();
    const [busy, setBusy] = useState(false);
    const [comment, setComment] = useState("");
    const [webinarPickerOpen, setWebinarPickerOpen] = useState(false);
    const [pendingWebinar, setPendingWebinar] = useState<{
        run: QualificationActionRun;
        webinarId: string;
        qualification: LeadQualification;
    } | null>(null);

    const treeSegment = useMemo(
        () => findOutcomeSegment(flow.templateTree, outcome),
        [flow.templateTree, outcome],
    );

    const bodyText =
        treeSegment?.label?.trim() || FALLBACK_OUTCOME_BODIES[outcome];
    const ctaLabel =
        treeSegment?.outcomeMetadata?.label?.trim() ||
        FALLBACK_OUTCOME_CTA[outcome];
    const title = DEFAULT_OUTCOME_LABELS[outcome];

    const answer = treeSegment ? flow.answers[treeSegment.key] : undefined;
    const selectedValues = answer?.answer_values ?? [];
    const optionChoices = (treeSegment?.options ?? []).map((option) => ({
        value: option.id,
        label: stripHtmlTags(option.label) || option.label,
    }));

    const registrationPayload = useMemo(() => {
        const { firstName, lastName } = splitLeadName(lead.client_name);
        const marketing = lead.marketing;
        return {
            email: lead.client_email ?? "",
            firstName,
            lastName,
            phone: lead.mobile ?? lead.cell ?? undefined,
            leadId: lead.id,
            language: agentLanguage,
            country: lead.country ?? undefined,
            city: lead.city ?? undefined,
            state: lead.state ?? undefined,
            zipCode: lead.postal_code ?? undefined,
            gender: lead.gender ?? undefined,
            utmInfo: marketing?.utm_source
                ? {
                      utmSource: marketing.utm_source,
                      utmMedium: marketing.utm_medium ?? undefined,
                      utmCampaign: marketing.utm_campaign ?? undefined,
                      utmTerm: marketing.utm_term ?? undefined,
                      utmContent: marketing.utm_content ?? undefined,
                  }
                : undefined,
        };
    }, [agentLanguage, lead]);

    const markExecuted = async (
        qualification: LeadQualification,
        run: QualificationActionRun,
        payload: Record<string, unknown> = {},
        error?: string,
    ) => {
        const result = await qualificationService.executeAction(
            qualification.id,
            run.id,
            { payload, error: error ?? null },
        );
        onCompleted(result.qualification);
        return result.qualification;
    };

    const executeRun = async (
        qualification: LeadQualification,
        run: QualificationActionRun,
    ): Promise<"done" | "needs_input"> => {
        const type = run.action_type;

        if (type === "invite_webinar") {
            const webinarId = run.config?.webinarId;
            if (!webinarId) {
                message.error(td("Webinar is not configured for this action."));
                await markExecuted(
                    qualification,
                    run,
                    {},
                    "Webinar not configured",
                );
                return "done";
            }
            setPendingWebinar({ run, webinarId, qualification });
            setWebinarPickerOpen(true);
            return "needs_input";
        }

        if (type === "book_consultation") {
            try {
                await registrationService.bookConsultationCalendly({
                    ...registrationPayload,
                    calendlyUrl: run.config?.calendlyUrl,
                });
                await markExecuted(qualification, run, {
                    calendlyUrl: run.config?.calendlyUrl ?? null,
                });
                message.success(td("Consultation booking started"));
            } catch (error) {
                const msg =
                    error instanceof Error
                        ? error.message
                        : "Failed to book consultation";
                message.error(msg);
                try {
                    await markExecuted(qualification, run, {}, msg);
                } catch {
                    // ignore
                }
            }
            return "done";
        }

        if (NO_OP.has(type)) {
            try {
                await markExecuted(qualification, run, {});
                message.success(td("Action recorded"));
            } catch (error) {
                message.error(
                    error instanceof Error
                        ? error.message
                        : "Failed to record action",
                );
            }
            return "done";
        }

        message.warning(td("This action is not available yet."));
        return "done";
    };

    const handleCta = async () => {
        if (busy || flow.completing) return;
        setBusy(true);
        try {
            if (treeSegment && selectedValues.length) {
                await flow.applyAnswerChange(
                    treeSegment,
                    selectedValues,
                    comment || null,
                );
            }

            const updated = await flow.completeWithOutcome(outcome, {
                comment: comment || null,
            });
            if (!updated) return;

            onCompleted(updated);

            const pendingRuns = (updated.action_runs ?? []).filter(
                (run) =>
                    run.status !== "completed" && run.status !== "unavailable",
            );
            const primary = pendingRuns[0];
            if (!primary) {
                onDone(updated);
                return;
            }

            const result = await executeRun(updated, primary);
            if (result === "done") {
                onDone(updated);
            }
        } catch {
            // errors already toasted
        } finally {
            setBusy(false);
        }
    };

    const runInviteWebinar = async (
        sessionId: string,
        sessionLabel: string,
    ) => {
        if (!pendingWebinar) return;
        setBusy(true);
        try {
            await registrationService.registerWebinarSession(
                sessionId,
                registrationPayload,
            );
            const updated = await markExecuted(
                pendingWebinar.qualification,
                pendingWebinar.run,
                {
                    webinarSessionId: sessionId,
                    webinarSessionLabel: sessionLabel,
                },
            );
            message.success(td("Webinar registration completed"));
            setPendingWebinar(null);
            setWebinarPickerOpen(false);
            onDone(updated);
        } catch (error) {
            const msg =
                error instanceof Error
                    ? error.message
                    : "Failed to register webinar";
            message.error(msg);
            try {
                await markExecuted(
                    pendingWebinar.qualification,
                    pendingWebinar.run,
                    {},
                    msg,
                );
            } catch {
                // ignore
            }
        } finally {
            setBusy(false);
        }
    };

    const selectOption = (optionId: string) => {
        if (!treeSegment) return;
        void flow.applyAnswerChange(treeSegment, [optionId], comment || null);
    };

    return (
        <DynamicTranslationProvider locale={agentLanguage}>
            <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-4">
                    <div className="flex gap-4 mb-7">
                        <NumberBadge
                            number="★"
                            answered={Boolean(selectedValues.length)}
                        />
                        <div className="flex-1 min-w-0">
                            <p
                                className="text-xs font-semibold uppercase tracking-wider mb-2"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {td("Outcome", { source: "en" })}
                            </p>
                            <p
                                className="text-base font-semibold mb-2 leading-snug"
                                style={{ color: T.TEXT }}
                            >
                                {td(title, { source: "en" })}
                            </p>
                            <OutcomeBody
                                text={bodyText}
                                translateScript={flow.translateScript}
                            />
                            <p
                                className="text-sm mt-3 mb-4"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {td(
                                    "Confirm the outcome with the lead, then continue.",
                                    { source: "en" },
                                )}
                            </p>

                            {optionChoices.length > 0 ? (
                                <div className="mb-4">
                                    <p
                                        className="text-sm font-medium mb-2"
                                        style={{ color: T.TEXT }}
                                    >
                                        {td("Select an option", {
                                            source: "en",
                                        })}
                                    </p>
                                    <RadioInput
                                        value={selectedValues[0] ?? ""}
                                        options={optionChoices}
                                        onChange={selectOption}
                                    />
                                </div>
                            ) : null}

                            <p
                                className="text-xs font-semibold uppercase tracking-wider mb-1.5"
                                style={{ color: T.TEXT }}
                            >
                                {td("Comment", { source: "en" })}
                            </p>
                            <AnalysisTextarea
                                value={comment}
                                onChange={setComment}
                                placeholder={td("Optional outcome comment…", {
                                    source: "en",
                                })}
                                disabled={busy || flow.completing}
                            />
                        </div>
                    </div>
                </div>

                <OutcomeFooter
                    onBack={onBack}
                    backLabel={td("Previous", { source: "en" })}
                    onPrimary={() => void handleCta()}
                    primaryLabel={
                        busy || flow.completing
                            ? td("Working…", { source: "en" })
                            : td(ctaLabel, { source: "en" })
                    }
                    primaryDisabled={busy || flow.completing}
                />

                {pendingWebinar ? (
                    <WebinarSessionPickerModal
                        open={webinarPickerOpen}
                        webinarId={pendingWebinar.webinarId}
                        registrationService={registrationService}
                        onClose={() => {
                            setWebinarPickerOpen(false);
                            setPendingWebinar(null);
                            onDone(pendingWebinar.qualification);
                        }}
                        onSelect={(sessionId, sessionLabel) =>
                            void runInviteWebinar(sessionId, sessionLabel)
                        }
                    />
                ) : null}
            </div>
        </DynamicTranslationProvider>
    );
}

function OutcomeBody({
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
            className="qualify-segment-prompt text-base font-normal leading-snug"
            quoted
        />
    );
}
