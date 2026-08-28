import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useQueries } from "@tanstack/react-query";
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
import {
    hasAnswerContent,
    protectScriptForTranslation,
    stripHtmlTags,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import {
    useTd,
    useDynamicTranslationPending,
    useDynamicTranslations,
    makeDynamicTranslationKey,
} from "@/Hooks/useDynamicTranslation";
import { DynamicTranslationProvider } from "@/contexts/DynamicTranslationContext";
import { useTranslationContext } from "@/contexts/TranslationContext";
import {
    dynamicTranslationBatcher,
    hashDynamicText,
    normalizeDynamicText,
} from "@/lib/dynamicTranslation";
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
    /**
     * Null while the start call is still in flight — the modal renders its
     * shell immediately so opening feels instant, then swaps to the script.
     */
    qualification: LeadQualification | null;
    /** True while the OL template tree is still loading for this run. */
    treeLoading?: boolean;
    /** True from the click that started the run until the server confirms it. */
    starting?: boolean;
    templateTree: TemplateTree | null;
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

const TRANSLATING_SUBTEXT: Record<string, string> = {
    en: "Preparing the script in your language. This will only take a moment.",
    de: "Das Skript wird in Ihrer Sprache vorbereitet. Einen Moment bitte.",
    tr: "Senaryo dilinizde hazırlanıyor. Bu sadece birkaç saniye sürecek.",
    ru: "Подготавливаем сценарий на вашем языке. Это займёт немного времени.",
};

const CONTINUE_ANYWAY_LABEL: Record<string, string> = {
    en: "Continue without waiting",
    de: "Ohne Warten fortfahren",
    tr: "Beklemeden devam et",
    ru: "Продолжить, не дожидаясь",
};

const CONTINUE_ANYWAY_HINT: Record<string, string> = {
    en: "Some lines may still show in English.",
    de: "Einige Zeilen werden möglicherweise noch auf Englisch angezeigt.",
    tr: "Bazı satırlar hâlâ İngilizce görünebilir.",
    ru: "Некоторые строки могут остаться на английском.",
};

/** How long the gate blocks before offering a way past it. */
const TRANSLATION_GATE_ESCAPE_MS = 20_000;

/**
 * True while any of `texts` (English source strings) is missing a cached
 * translation for `locale`. Scoped to exactly this list — unlike
 * `useDynamicTranslationPending`, it does not flip on for unrelated
 * translations elsewhere (an answer combination first seen on this segment,
 * a UI string translated on demand), so navigating around the modal after
 * the initial batch lands never reports "pending" again.
 */
function useBatchTranslationPending(texts: string[], locale: string): boolean {
    const relevant = useMemo(
        () =>
            texts.filter((text) => text && normalizeDynamicText(text) !== ""),
        [texts],
    );

    const queries = useQueries({
        queries: relevant.map((text) => {
            const hash = hashDynamicText(text);
            return {
                queryKey: makeDynamicTranslationKey(locale, hash),
                enabled: false,
                queryFn: async () => null as string | null,
                initialData: null as string | null,
                staleTime: 30_000,
            };
        }),
    });

    if (locale === "en" || relevant.length === 0) {
        return false;
    }

    return queries.some(
        (query) => typeof query.data !== "string" || query.data === "",
    );
}

/**
 * True while the up-front script batch (`pending`, from
 * `useBatchTranslationPending`) for `language` is still resolving, debounced
 * so quick batches don't flicker the gate: shows after a short delay once
 * activity starts, hides only after activity has fully settled for a beat.
 *
 * This only reacts to the language-selector-driven batch — never to
 * incidental translations elsewhere in the modal — so it opens exactly when
 * the agent switches languages and never mid-navigation.
 *
 * If it's still stuck after `TRANSLATION_GATE_ESCAPE_MS`, `canDismiss` flips
 * on so the caller can offer a way out. `dismiss()` hides the gate for that
 * language only — switching to a different language is a brand new
 * translation burst and must show the gate again even if a prior language
 * was dismissed.
 */
function useTranslationGateVisible(
    language: string,
    pending: boolean,
): {
    visible: boolean;
    canDismiss: boolean;
    dismiss: () => void;
} {
    const [visible, setVisible] = useState(false);
    const [canDismiss, setCanDismiss] = useState(false);
    // The language a prior `dismiss()` applies to — not a plain boolean, so
    // switching languages doesn't inherit an earlier dismissal.
    const [dismissedForLanguage, setDismissedForLanguage] = useState<
        string | null
    >(null);
    const dismissed = dismissedForLanguage === language;
    const visibleRef = useRef(false);
    visibleRef.current = visible;
    const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const escapeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimers = () => {
        if (showTimer.current) clearTimeout(showTimer.current);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (escapeTimer.current) clearTimeout(escapeTimer.current);
        showTimer.current = null;
        hideTimer.current = null;
        escapeTimer.current = null;
    };

    // A language switch is a fresh burst — it gets its own escape timer and
    // must show the gate again even if a previous visit to this same
    // language was dismissed.
    const prevLanguageRef = useRef(language);
    useEffect(() => {
        if (prevLanguageRef.current !== language) {
            prevLanguageRef.current = language;
            clearTimers();
            setCanDismiss(false);
            setDismissedForLanguage(null);
        }
    }, [language]);

    useEffect(() => {
        if (language === "en" || dismissed) {
            clearTimers();
            setVisible(false);
            setCanDismiss(false);
            return;
        }

        if (pending) {
            if (hideTimer.current) {
                clearTimeout(hideTimer.current);
                hideTimer.current = null;
            }
            // Small delay so quick batches never flash the gate.
            if (!visibleRef.current && showTimer.current === null) {
                showTimer.current = setTimeout(() => {
                    showTimer.current = null;
                    setVisible(true);
                }, 100);
            }
            if (escapeTimer.current === null && !canDismiss) {
                escapeTimer.current = setTimeout(() => {
                    escapeTimer.current = null;
                    setCanDismiss(true);
                }, TRANSLATION_GATE_ESCAPE_MS);
            }
        } else if (!hideTimer.current) {
            if (showTimer.current) {
                clearTimeout(showTimer.current);
                showTimer.current = null;
            }
            if (escapeTimer.current) {
                clearTimeout(escapeTimer.current);
                escapeTimer.current = null;
            }
            hideTimer.current = setTimeout(() => {
                hideTimer.current = null;
                setVisible(false);
                setCanDismiss(false);
            }, 350);
        }
    }, [pending, language, dismissed, canDismiss]);

    useEffect(() => {
        return clearTimers;
    }, []);

    const dismiss = useCallback(() => {
        clearTimers();
        setDismissedForLanguage(language);
        setVisible(false);
        setCanDismiss(false);
        dynamicTranslationBatcher.cancelPending(language);
    }, [language]);

    return { visible, canDismiss, dismiss };
}

/**
 * Full-modal blocking gate shown while the script is being translated.
 * Renders inside the modal panel so it overlays exactly the modal —
 * the rest of the page stays interactive, the modal does not. Offers a way
 * past itself once it's been stuck for a while (see `canDismiss`).
 */
function TranslationGate({
    language,
    canDismiss,
    onDismiss,
}: {
    language: string;
    canDismiss: boolean;
    onDismiss: () => void;
}) {
    const label =
        TRANSLATING_LABEL[language] ?? TRANSLATING_LABEL.en;
    const subtext =
        TRANSLATING_SUBTEXT[language] ?? TRANSLATING_SUBTEXT.en;

    return (
        <div className="analysis-translation-gate" role="status" aria-live="polite">
            <div className="analysis-translation-gate-card">
                <div
                    className="h-9 w-9 animate-spin rounded-full border-[3px] border-solid border-slate-200 border-t-slate-700"
                    aria-hidden
                />
                <div>
                    <p
                        className="m-0 text-[15px] font-bold"
                        style={{ color: T.TEXT }}
                    >
                        {label}
                    </p>
                    <p
                        className="mt-1 mb-0 text-[12px]"
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {subtext}
                    </p>
                    {canDismiss && (
                        <>
                            <button
                                type="button"
                                onClick={onDismiss}
                                className="mt-3 text-[12px] font-semibold underline underline-offset-2"
                                style={{ color: T.TEXT, cursor: "pointer" }}
                            >
                                {CONTINUE_ANYWAY_LABEL[language] ??
                                    CONTINUE_ANYWAY_LABEL.en}
                            </button>
                            <p
                                className="mt-1 mb-0 text-[11px]"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {CONTINUE_ANYWAY_HINT[language] ??
                                    CONTINUE_ANYWAY_HINT.en}
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

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
            : props.qualification?.agent_language || "en",
    );

    if (!props.open) {
        return null;
    }

    const leadName = props.lead.client_name || "Lead";

    // Tree still loading / missing / run not yet confirmed by the server:
    // keep the same portal shell mounted so the overlay does not blink when
    // the script arrives. The modal itself is the loading state.
    if (!props.qualification || !props.templateTree) {
        const statusText = !props.qualification
            ? props.starting
                ? "Preparing your qualification call…"
                : "Qualification unavailable."
            : props.treeLoading
              ? "Loading qualification script…"
              : "Qualification script unavailable.";

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
                            {!props.qualification || props.treeLoading ? (
                                <div
                                    className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
                                    aria-hidden
                                />
                            ) : null}
                            <p className="m-0 text-sm text-slate-600">
                                {statusText}
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
                qualification={props.qualification}
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
}: Omit<QualifyModalProps, "templateTree" | "treeLoading" | "qualification"> & {
    qualification: LeadQualification;
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

    // Translating a segment takes a queue hop plus an API call per locale, so
    // request the whole script up front instead of one step ahead of the
    // agent — by the time the user reaches a later segment it's already
    // sitting in cache. This must be a real subscription (not `batcher.warm`,
    // which drops a miss on the floor when nobody's listening yet) so every
    // segment actually gets retried until it resolves, not just the one
    // currently on screen. Text must match what each segment/option looks up
    // below byte-for-byte, or this pre-fetches the wrong hash — segment labels
    // go through `protectScriptForTranslation` (see `useTranslatedScriptLabel`)
    // before translation so embedded HTML/tokens don't reach the API raw.
    const wholeScriptTexts = useMemo(
        () =>
            templateTree.segments.flatMap((segment) => [
                protectScriptForTranslation(segment.label).text,
                ...(segment.options ?? []).map(
                    (option) => stripHtmlTags(option.label) || option.label,
                ),
            ]),
        [templateTree],
    );
    useDynamicTranslations(wholeScriptTexts, { source: "en" });
    const scriptBatchPending = useBatchTranslationPending(
        wholeScriptTexts,
        agentLanguage,
    );

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

    const {
        visible: translationGateVisible,
        canDismiss: translationGateCanDismiss,
        dismiss: dismissTranslationGate,
    } = useTranslationGateVisible(agentLanguage, scriptBatchPending);

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
                {translationGateVisible && (
                    <TranslationGate
                        language={agentLanguage}
                        canDismiss={translationGateCanDismiss}
                        onDismiss={dismissTranslationGate}
                    />
                )}
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
