import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Lead } from "@/Types/api/leads";
import type {
    LeadQualification,
    QualificationLeadPatch,
    QualificationOutcome,
    TemplateTree,
} from "@/Types/qualification";
import { getRegistrationService } from "@/Services/RegistrationService";
import { useLeadQualificationService } from "@/Services/LeadQualificationService";
import useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import { hasAnswerContent } from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { useTd, useDynamicTranslationPending } from "@/Hooks/useDynamicTranslation";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useTranslationContext } from "@/contexts/TranslationContext";
import { dynamicTranslationBatcher } from "@/lib/dynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";
import AnalysisHeaderBar from "@/Pages/Deals/Redesign/components/analysis/AnalysisHeaderBar";
import QualifySegmentBody from "./QualifySegmentBody";
import QualifyFooter from "./QualifyFooter";
import QualifyLeadContextPanel from "./QualifyLeadContextPanel";
import QualifyRightRail, {
    type QualifyRightRailTab,
} from "./QualifyRightRail";
import QualifyOutcomePhase from "./QualifyOutcomePhase";
import QualifyContextNote from "./QualifyContextNote";

const LANGUAGE_OPTIONS = [
    { value: "en", label: "English" },
    { value: "de", label: "German" },
    { value: "tr", label: "Turkish" },
    { value: "ru", label: "Russian" },
];

type Phase = "script" | "outcome";

interface QualifyModalProps {
    open: boolean;
    lead: Lead;
    qualification: LeadQualification;
    templateTree: TemplateTree | null;
    /** True while the OL template tree is still loading for this run. */
    treeLoading?: boolean;
    onClose: () => void;
    onCompleted: (qualification: LeadQualification) => void;
    onActionsDone?: (qualification: LeadQualification) => void;
    /** Fired when completing an outcome also changed the lead's lifecycle status server-side. */
    onLeadUpdated?: (lead: QualificationLeadPatch) => void;
    /** Lead custom fields + categories for the in-modal Lead info panel. */
    fields?: any[];
    customFieldCategories?: Array<{ id: number; name: string }>;
    editLeadPermission?: string;
    /** Meeting types for the inline book-meeting/callback forms in the outcome step. */
    meetingTypes?: Array<{ id: number; name: string; color?: string }>;
}

// ponytail: hardcoded — running this label through `td` would translate it in
// the same locale it reports on, so the badge would keep itself "pending".
const TRANSLATING_LABEL: Record<string, string> = {
    en: "Translating…",
    de: "Übersetze…",
    tr: "Çevriliyor…",
    ru: "Перевод…",
};

/** Small "Translating…" hint beside the language picker (inside the provider). */
function TranslatingIndicator({ language }: { language: string }) {
    const pending = useDynamicTranslationPending();

    if (!pending) {
        return null;
    }

    return (
        <span
            className="text-[11px] font-medium whitespace-nowrap"
            style={{ color: "rgba(255,255,255,0.85)" }}
            role="status"
        >
            {TRANSLATING_LABEL[language] ?? TRANSLATING_LABEL.en}
        </span>
    );
}

function QualifyModalShell({
    open,
    titleId,
    leadName,
    onMinimize,
    children,
}: {
    open: boolean;
    titleId: string;
    leadName: string;
    onMinimize: () => void;
    children: ReactNode;
}) {
    const { td } = useTd();

    if (!open || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className="analysis-modal-overlay">
            <div
                className="analysis-modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onScroll={(e) => {
                    if (e.target !== e.currentTarget) return;
                    e.currentTarget.scrollTop = 0;
                    e.currentTarget.scrollLeft = 0;
                }}
            >
                <AnalysisHeaderBar
                    title={td("Qualify", { source: "en" })}
                    leadName={leadName}
                    isCompleted={false}
                    totalFilled={0}
                    totalFields={0}
                    onMinimize={onMinimize}
                />
                <span id={titleId} className="sr-only">
                    {td("Qualify", { source: "en" })} {leadName}
                </span>
                {children}
            </div>
        </div>,
        document.body,
    );
}

export default function QualifyModal(props: QualifyModalProps) {
    const { locale: appLocale } = useTranslationContext();
    // The agent's own locale wins when we can script in it; qualifications are
    // created with a hard-coded "en" so a stored value is only a weak signal.
    const [agentLanguage, setAgentLanguage] = useState(
        LANGUAGE_OPTIONS.some((option) => option.value === appLocale)
            ? appLocale
            : props.qualification.agent_language || "en",
    );

    if (!props.open) {
        return null;
    }

    // Tree still loading / missing: keep the same portal shell mounted so the
    // overlay does not blink when the script arrives.
    if (!props.templateTree) {
        const leadName = props.lead.client_name || "Lead";
        return (
            <DynamicTranslationProvider locale={agentLanguage}>
                <QualifyModalShell
                    open={props.open}
                    titleId="qualify-modal-title"
                    leadName={leadName}
                    onMinimize={props.onClose}
                >
                    <div className="flex flex-1 min-h-0 items-center justify-center bg-slate-50">
                        <div className="text-center px-6">
                            <div
                                className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
                                aria-hidden
                            />
                            <p className="m-0 text-sm text-slate-600">
                                {props.treeLoading
                                    ? "Loading qualification script…"
                                    : "Qualification script unavailable."}
                            </p>
                        </div>
                    </div>
                </QualifyModalShell>
            </DynamicTranslationProvider>
        );
    }

    return (
        <DynamicTranslationProvider locale={agentLanguage}>
            <QualifyModalContent
                {...props}
                templateTree={props.templateTree}
                agentLanguage={agentLanguage}
                onAgentLanguageChange={setAgentLanguage}
            />
        </DynamicTranslationProvider>
    );
}

function QualifyModalContent({
    open,
    lead,
    qualification,
    templateTree,
    onClose,
    onCompleted,
    onActionsDone,
    onLeadUpdated,
    fields,
    customFieldCategories,
    editLeadPermission,
    meetingTypes,
    agentLanguage,
    onAgentLanguageChange,
}: Omit<QualifyModalProps, "templateTree" | "treeLoading"> & {
    templateTree: TemplateTree;
    agentLanguage: string;
    onAgentLanguageChange: (language: string) => void;
}) {
    const { td } = useTd();
    const qualificationService = useLeadQualificationService();
    const registrationService = useMemo(() => getRegistrationService(), []);
    const [phase, setPhase] = useState<Phase>("script");
    const [selectedOutcome, setSelectedOutcome] =
        useState<QualificationOutcome | null>(null);
    const [completedQualification, setCompletedQualification] =
        useState<LeadQualification | null>(null);
    const [confirmIntent, setConfirmIntent] = useState<null | "close">(null);
    const [rightRailTab, setRightRailTab] =
        useState<QualifyRightRailTab>("steps");
    const titleId = "qualify-modal-title";

    const flow = useQualificationFlow({
        lead,
        qualification,
        templateTree,
        service: qualificationService,
        registrationService,
        agentLanguage,
        onQualificationUpdated: (updated) => {
            if (updated.status === "completed") {
                setCompletedQualification(updated);
            }
            onCompleted(updated);
        },
        onLeadUpdated,
    });

    const walkSegments = flow.walkSegments;
    const questionSegments = useMemo(
        () => walkSegments.filter((s) => s.type === "question"),
        [walkSegments],
    );
    const totalFields = questionSegments.length;
    const totalFilled = useMemo(
        () =>
            questionSegments.filter((s) =>
                hasAnswerContent(flow.answers[s.key]),
            ).length,
        [questionSegments, flow.answers],
    );
    const unfilledCount = Math.max(0, totalFields - totalFilled);
    const isCompleted =
        completedQualification?.status === "completed" ||
        qualification.status === "completed";

    const doClose = async (updated?: LeadQualification | null) => {
        await flow.flushPendingSaves();
        const q = updated ?? completedQualification;
        // Close first so the parent unmounts on `open=false` — finishing the
        // session must not clear tree/state while the modal is still "open".
        onClose();
        if (q && onActionsDone) {
            onActionsDone(q);
        }
    };

    const requestClose = () => {
        if (isCompleted || unfilledCount === 0) {
            void doClose();
            return;
        }
        setConfirmIntent("close");
    };

    // Translating a segment takes a queue hop plus an API call per locale, so
    // queue the whole script up front instead of one step ahead of the agent.
    useEffect(() => {
        if (!open) return;
        dynamicTranslationBatcher.warm(
            agentLanguage,
            templateTree.segments.flatMap((segment) => [
                segment.label,
                ...(segment.options ?? []).map((option) => option.label),
            ]),
        );
    }, [open, agentLanguage, templateTree]);

    useEffect(() => {
        if (!open) return;
        if (flow.currentSegment?.type === "outcome") {
            setPhase("outcome");
            setRightRailTab("answers");
        }
    }, [open, flow.currentSegment?.type]);

    // On the last script step, surface captured answers for review before outcome.
    useEffect(() => {
        if (!open || phase !== "script") return;
        if (
            walkSegments.length > 0 &&
            (flow.isLastWalkSegment ||
                flow.walkIndex === walkSegments.length - 1)
        ) {
            setRightRailTab("answers");
        }
    }, [
        open,
        phase,
        flow.isLastWalkSegment,
        flow.walkIndex,
        walkSegments.length,
    ]);

    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || flow.completing) return;
            if (confirmIntent) {
                setConfirmIntent(null);
                return;
            }
            requestClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, flow.completing, confirmIntent, isCompleted, unfilledCount]);

    if (!open || typeof document === "undefined") {
        return null;
    }

    const leadName = lead.client_name || td("Lead", { source: "en" });
    const inOutcome = phase === "outcome";
    const segment =
        flow.currentSegment?.type === "outcome"
            ? walkSegments[walkSegments.length - 1]
            : flow.currentSegment;

    const questionNumber = segment
        ? questionSegments.findIndex((s) => s.key === segment.key) + 1
        : 0;

    const progressPct =
        totalFields > 0 ? Math.round((totalFilled / totalFields) * 100) : 0;

    const handleJump = (segmentKey: string) => {
        setPhase("script");
        setSelectedOutcome(null);
        setRightRailTab("steps");
        void flow.jumpToSegment(segmentKey);
    };

    const handleNextFromScript = async (options?: {
        skipValidation?: boolean;
    }) => {
        if (
            flow.isLastWalkSegment ||
            flow.walkIndex === walkSegments.length - 1
        ) {
            if (flow.validationError && !options?.skipValidation) {
                await flow.goNext(options);
                return;
            }
            setPhase("outcome");
            setSelectedOutcome(null);
            setRightRailTab("answers");
            return;
        }
        const next = walkSegments[flow.walkIndex + 1];
        if (next) {
            if (flow.validationError && !options?.skipValidation) {
                await flow.goNext(options);
                return;
            }
            await flow.jumpToSegment(next.key);
        }
    };

    const handleBackFromOutcome = () => {
        if (selectedOutcome) {
            setSelectedOutcome(null);
            return;
        }
        setPhase("script");
        setRightRailTab("steps");
        const last = walkSegments[walkSegments.length - 1];
        if (last) {
            void flow.jumpToSegment(last.key);
        }
    };

    return createPortal(
        <div className="analysis-modal-overlay">
            <div
                className="analysis-modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onScroll={(e) => {
                    if (e.target !== e.currentTarget) return;
                    e.currentTarget.scrollTop = 0;
                    e.currentTarget.scrollLeft = 0;
                }}
            >
                <AnalysisHeaderBar
                    title={td("Qualify", { source: "en" })}
                    leadName={leadName}
                    isCompleted={isCompleted}
                    totalFilled={totalFilled}
                    totalFields={totalFields}
                    subscribeSaving={flow.subscribeSaving}
                    onMinimize={requestClose}
                    trailingActions={
                        !isCompleted ? (
                            <span className="inline-flex items-center gap-2">
                                <TranslatingIndicator
                                    language={agentLanguage}
                                />
                                <select
                                    value={agentLanguage}
                                    onChange={(e) =>
                                        onAgentLanguageChange(e.target.value)
                                    }
                                    aria-label={td("Script language", {
                                        source: "en",
                                    })}
                                    className="rounded-md text-xs font-medium"
                                    style={{
                                        background: "rgba(255,255,255,0.12)",
                                        color: "#fff",
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        padding: "6px 10px",
                                        minWidth: 110,
                                    }}
                                >
                                    {LANGUAGE_OPTIONS.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                            style={{ color: T.TEXT }}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </span>
                        ) : null
                    }
                />
                <span id={titleId} className="sr-only">
                    {td("Qualify", { source: "en" })} {leadName}
                </span>

                <div className="analysis-3col-body">
                    <div className="analysis-3col-left">
                        <QualifyLeadContextPanel
                            lead={lead}
                            fields={fields}
                            customFieldCategories={customFieldCategories}
                            editLeadPermission={editLeadPermission}
                        />
                    </div>

                    <div className="analysis-3col-center">
                        {inOutcome ? (
                            <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
                                <div
                                    className="shrink-0 px-6 pt-4 pb-3 bg-slate-50"
                                    style={{
                                        borderBottom: "1px solid #e2e8f0",
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-black">
                                            {td("Qualification Progress", {
                                                source: "en",
                                            })}
                                        </span>
                                        <span className="text-xs tabular-nums text-black">
                                            <span className="font-semibold text-black">
                                                {totalFilled}
                                            </span>{" "}
                                            {td("of", { source: "en" })}{" "}
                                            {totalFields}{" "}
                                            {td("questions", {
                                                source: "en",
                                            })}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{
                                                width: `${progressPct}%`,
                                                backgroundColor:
                                                    progressPct === 100
                                                        ? "#10b981"
                                                        : "#38bdf8",
                                            }}
                                        />
                                    </div>
                                </div>
                                <QualifyOutcomePhase
                                    flow={flow}
                                    lead={lead}
                                    agentLanguage={agentLanguage}
                                    qualificationService={
                                        qualificationService
                                    }
                                    registrationService={registrationService}
                                    meetingTypes={meetingTypes ?? []}
                                    selectedOutcome={selectedOutcome}
                                    onSelectOutcome={setSelectedOutcome}
                                    onBack={handleBackFromOutcome}
                                    onCompleted={(updated) => {
                                        setCompletedQualification(updated);
                                        onCompleted(updated);
                                    }}
                                    onDone={(updated) => void doClose(updated)}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50">
                                    <div
                                        className="sticky top-0 z-10 px-6 pt-4 pb-3 bg-slate-50/95 backdrop-blur-sm"
                                        style={{
                                            borderBottom: "1px solid #e2e8f0",
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[11px] font-semibold uppercase tracking-wider text-black">
                                                {td("Qualification Progress", {
                                                    source: "en",
                                                })}
                                            </span>
                                            <span className="text-xs tabular-nums text-black">
                                                <span className="font-semibold text-black">
                                                    {totalFilled}
                                                </span>{" "}
                                                {td("of", { source: "en" })}{" "}
                                                {totalFields}{" "}
                                                {td("questions", {
                                                    source: "en",
                                                })}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${progressPct}%`,
                                                    backgroundColor:
                                                        progressPct === 100
                                                            ? "#10b981"
                                                            : "#38bdf8",
                                                }}
                                            />
                                        </div>
                                        {templateTree.name ? (
                                            <p className="mt-2 text-[11px] text-slate-400 truncate">
                                                {templateTree.name}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="px-6 pt-5 pb-8">
                                        {segment ? (
                                            <QualifySegmentBody
                                                flow={flow}
                                                currentSegment={segment}
                                                agentLanguage={agentLanguage}
                                                questionNumber={
                                                    questionNumber > 0
                                                        ? questionNumber
                                                        : undefined
                                                }
                                            />
                                        ) : (
                                            <p className="text-sm text-slate-400">
                                                {td(
                                                    "No steps available for this template.",
                                                    { source: "en" },
                                                )}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {segment?.type === "question" ? (
                                    <QualifyContextNote
                                        mode={
                                            segment.answerType === "text"
                                                ? "answer"
                                                : "context"
                                        }
                                        value={
                                            flow.answers[segment.key]
                                                ?.answer_text ?? ""
                                        }
                                        onChange={(text) => {
                                            const values =
                                                flow.answers[segment.key]
                                                    ?.answer_values ?? [];
                                            flow.applyAnswerChange(
                                                segment,
                                                segment.answerType === "text"
                                                    ? []
                                                    : values,
                                                text || null,
                                            );
                                        }}
                                    />
                                ) : null}

                                <QualifyFooter
                                    flow={flow}
                                    onNext={handleNextFromScript}
                                    treatAsLast={
                                        flow.walkIndex ===
                                            walkSegments.length - 1 ||
                                        flow.isLastWalkSegment
                                    }
                                    finishLabel={td("Choose outcome", {
                                        source: "en",
                                    })}
                                />
                            </>
                        )}
                    </div>

                    <div className="analysis-3col-right qualify-3col-right">
                        <QualifyRightRail
                            segments={walkSegments}
                            answers={flow.answers}
                            currentSegmentKey={
                                inOutcome ? undefined : segment?.key
                            }
                            onJump={handleJump}
                            translateScript={flow.translateScript}
                            tab={rightRailTab}
                            onTabChange={setRightRailTab}
                        />
                    </div>
                </div>

                {confirmIntent && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(255,255,255,0.97)",
                            zIndex: 50,
                            borderRadius: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "40px 32px",
                        }}
                    >
                        <div style={{ textAlign: "center", maxWidth: 380 }}>
                            <div style={{ fontSize: 44, marginBottom: 16 }}>
                                ⚠️
                            </div>
                            <h3
                                style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: T.TEXT,
                                    marginBottom: 10,
                                    lineHeight: 1.3,
                                }}
                            >
                                {td("Finish with missing information?", {
                                    source: "en",
                                })}
                            </h3>
                            <p
                                style={{
                                    fontSize: 14,
                                    color: T.TEXT_MUTED,
                                    marginBottom: 28,
                                    lineHeight: 1.6,
                                }}
                            >
                                <strong style={{ color: T.TEXT }}>
                                    {unfilledCount}{" "}
                                    {unfilledCount === 1
                                        ? td("question is still empty", {
                                              source: "en",
                                          })
                                        : td("questions are still empty", {
                                              source: "en",
                                          })}
                                </strong>
                                .{" "}
                                {td(
                                    "You can reopen the qualification later to fill in the rest.",
                                    { source: "en" },
                                )}
                            </p>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    justifyContent: "center",
                                    flexWrap: "wrap",
                                }}
                            >
                                <button
                                    type="button"
                                    className="dr-btn dr-btn-ghost"
                                    onClick={() => setConfirmIntent(null)}
                                >
                                    {td("Go back and fill in", {
                                        source: "en",
                                    })}
                                </button>
                                <button
                                    type="button"
                                    className="dr-btn dr-btn-primary"
                                    style={{ background: T.NAVY }}
                                    onClick={() => {
                                        setConfirmIntent(null);
                                        void doClose();
                                    }}
                                >
                                    {td("Close anyway", { source: "en" })}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
