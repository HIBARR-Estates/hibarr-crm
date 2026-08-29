import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useAnalysisFieldSave from "../../hooks/useAnalysisFieldSave";
import type { UseDealAnalysisReturn } from "../../hooks/useDealAnalysis";
import AnalysisLeadContextPanel from "./AnalysisLeadContextPanel";
import AnalysisHeaderBar from "./AnalysisHeaderBar";
import AnalysisScrollPanel, { type ScrollPanelHandle } from "./AnalysisScrollPanel";
import AnalysisRightRail, { type AnalysisRailTab } from "./AnalysisRightRail";
import { buildRailGroups } from "./analysisRailItems";
import { buildScriptItems, computeAnalysisProgress } from "./analysisProgress";
import type { AnalysisScriptItem } from "./types/analysisTypes";

interface Props {
    analysis: UseDealAnalysisReturn;
    dealInfoCategories: any[];
    fields: any[];
    // ponytail: kept for parent compat, not used here (pipeline scope filtering is server-side)
    visibleLeadFieldKeys?: string[] | null;
    analysisScript?: { items: AnalysisScriptItem[] } | null;
}

const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Stable identity so an absent prop doesn't invalidate memos every render. */
const EMPTY_FIELDS: any[] = [];

/** Text-entry controls where Left/Right must move the caret, never the section. */
const TEXT_ENTRY_TYPES = new Set([
    "text", "search", "url", "tel", "email", "password", "number", "date", "datetime-local", "month", "week", "time",
]);

function isTextEntryFocused(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type;
        return TEXT_ENTRY_TYPES.has(type);
    }
    return false;
}

export default function DealAnalysisModal({
    analysis,
    dealInfoCategories,
    fields,
    analysisScript,
}: Props) {
    const { deal, setDeal } = useDealWorkspace();
    const { props } = usePage<any>();
    const { t } = useTranslation();
    const { td } = useTd();
    const { save, failedKeys, retry, dismissError, flushAll, subscribeSaving } = useAnalysisFieldSave(deal.id);
    const { canEdit: baseCanEdit, isWatcherOnly } = useDealPermissions(deal);
    // Pure watchers are view-only on analysis (same as tasks/meetings/notes).
    const canEdit = baseCanEdit && !isWatcherOnly;
    const panelRef = useRef<HTMLDivElement>(null);
    const scrollPanelRef = useRef<ScrollPanelHandle>(null);
    const titleId = "analysis-modal-title";

    const [activeSection, setActiveSection] = useState<string>("");
    const [railTab, setRailTab] = useState<AnalysisRailTab>("steps");
    /** Focus mode hides both side rails so only the form column is left. */
    const [focusMode, setFocusMode] = useState(false);

    /** Required steps the customer wouldn't answer — persisted on the deal so the
     *  mark survives a reopen. Questions answered in this session are tracked
     *  alongside them: a question's answer is a note, so there is nothing on the
     *  deal to read it back from. */
    const [unanswered, setUnanswered] = useState<Record<string, unknown>>(() => {
        // Absent on a deal payload built before this column existed, and `[]` when
        // the json column is empty — normalise both to a plain object.
        const stored = (deal as any).analysis_unanswered;
        return stored && typeof stored === "object" ? { ...stored } : {};
    });
    const [answeredQuestions, setAnsweredQuestions] = useState<ReadonlySet<string>>(
        () => new Set<string>(),
    );
    const resolvedSteps = useMemo(() => {
        const set = new Set<string>(Object.keys(unanswered));
        answeredQuestions.forEach((k) => set.add(k));
        return set;
    }, [unanswered, answeredQuestions]);
    // Which action raised the missing-information warning. Closing and completing
    // share the same overlay — only the confirming button differs.
    const [confirmIntent, setConfirmIntent] = useState<null | "complete" | "close" | "required">(null);
    // Stepped flow: the centre panel reveals one section at a time. Everything past
    // currentStep stays locked until the footer's Next button advances it.
    const [currentStep, setCurrentStep] = useState(0);
    const lastStep = useRef(-1);

    // flushAll() dispatches pending writes right away and minimize() defers the
    // deal reload until they land, so closing never loses an edit.
    const doClose = useCallback(() => {
        analysis.minimize(flushAll());
    }, [flushAll, analysis]);

    // Single flat value store for all custom fields (deal + lead), keyed as field_${id}.
    // IDs are globally unique across the custom_fields table so no collision.
    const [localValues, setLocalValues] = useState<Record<string, any>>(() => ({
        ...(deal.custom_fields_data ?? {}),
        ...((props.leadCustomFieldsData as Record<string, any>) ?? {}),
    }));

    useEffect(() => {
        setLocalValues((prev) => ({
            ...prev,
            ...(deal.custom_fields_data ?? {}),
        }));
    }, [deal.custom_fields_data]);

    useEffect(() => {
        if (props.leadCustomFieldsData) {
            setLocalValues((prev) => ({
                ...prev,
                ...(props.leadCustomFieldsData as Record<string, any>),
            }));
        }
    }, [props.leadCustomFieldsData]);

    const handleFieldChange = useCallback((fieldId: number, value: any) => {
        setLocalValues((prev) => ({ ...prev, [`field_${fieldId}`]: value }));
    }, []);

    // EMPTY_FIELDS, not a fresh `[]`: an inline literal is a new identity every
    // render, which would invalidate every memo below it on each keystroke.
    const leadCustomFields: any[] =
        (props.leadCustomFields as any[] | null | undefined) ?? EMPTY_FIELDS;

    const scriptItems: AnalysisScriptItem[] = useMemo(
        () => buildScriptItems(analysisScript, dealInfoCategories),
        [analysisScript, dealInfoCategories],
    );

    // Sections + progress + global numbering — all in one pass, shared with the
    // deal-view status card so both use the same denominator.
    const { sections, sectionProgress, totalFilled, totalFields, numberByKey, requiredMissing, customFieldVisibility, filledSteps } = useMemo(
        () => computeAnalysisProgress(scriptItems, fields, localValues, deal, leadCustomFields, resolvedSteps),
        [scriptItems, fields, localValues, deal, leadCustomFields, resolvedSteps],
    );

    // An answer supersedes a "no answer provided" mark: drop it the moment one
    // lands, in state and on the deal, so the footer and the stored record can't
    // disagree. Re-runs harmlessly — clearing empties the list it reads.
    useEffect(() => {
        const stale = Object.keys(unanswered).filter(
            (key) => filledSteps.has(key) || answeredQuestions.has(key),
        );
        if (stale.length === 0) return;

        setUnanswered((prev) => {
            const next = { ...prev };
            stale.forEach((key) => delete next[key]);
            return next;
        });
        stale.forEach((key) => save(`unanswered:${key}`, null));
    }, [filledSteps, answeredQuestions, unanswered, save]);

    const unfilledCount = totalFields - totalFilled;
    const allFilled = totalFields > 0 && unfilledCount === 0;

    // Only the active section and the ones already stepped through are rendered.
    const visibleSections = useMemo(
        () => sections.slice(0, currentStep + 1),
        [sections, currentStep],
    );

    const goToStep = useCallback((index: number) => {
        setCurrentStep(Math.max(0, Math.min(index, sections.length - 1)));
    }, [sections.length]);

    // Keep the step in range if the section list changes underneath us.
    useEffect(() => {
        setCurrentStep((s) => Math.min(s, Math.max(0, sections.length - 1)));
    }, [sections.length]);

    // Sync the active section to the current step and scroll the newly revealed one
    // into view. Guarded on the step actually changing: `sections` is rebuilt on every
    // keystroke, and without this the panel would scroll while the user is typing.
    useEffect(() => {
        if (sections.length === 0) return;

        // On open, unlock through the furthest section that already holds data so
        // previously-filled sections aren't stepped through again.
        if (lastStep.current === -1) {
            let seeded = 0;
            sections.forEach((s, i) => {
                if ((sectionProgress[s.id]?.filled ?? 0) > 0) seeded = i;
            });
            lastStep.current = seeded;
            setCurrentStep(seeded);
            setActiveSection(sections[seeded].id);
            return; // adopted without scrolling
        }

        if (lastStep.current === currentStep) return;
        const target = sections[currentStep];
        if (!target) return;
        lastStep.current = currentStep;
        setActiveSection(target.id);
        const raf = requestAnimationFrame(() =>
            scrollPanelRef.current?.scrollToSection(target.id),
        );
        return () => cancelAnimationFrame(raf);
    }, [currentStep, sections, sectionProgress]);

    // Fire-and-forget save for lead custom fields
    const handleLeadFieldSave = useCallback((fieldId: number, value: any) => {
        save(`lead_field_${fieldId}`, value);
    }, [save]);

    // Script item field save — routes by updateType (custom_field, details,
    // hibarr_field, contact). Also mirrors the value onto the workspace deal so the
    // Deal Info tab reflects the edit while the modal is still open.
    const handleScriptFieldSave = useCallback((fieldKey: string, value: any, updateType: string) => {
        let key: string;
        if (updateType === "hibarr_field") key = `hibarr:${fieldKey}`;
        else if (updateType === "contact") key = `contact:${fieldKey}`;
        else key = fieldKey;
        save(key, value);

        // Lead custom fields have no home on the deal object — their value already
        // lives in localValues via onFieldChange, so patching the deal here would
        // just graft a stray `lead_field_N` key onto it.
        if (updateType === "lead_custom_field") return;

        setDeal((prev: any) => {
            if (updateType === "hibarr_field") {
                return { ...prev, hibarrFields: { ...(prev.hibarrFields ?? {}), [fieldKey]: value } };
            }
            if (updateType === "contact") {
                return { ...prev, contact: { ...(prev.contact ?? {}), [fieldKey]: value } };
            }
            if (updateType === "custom_field") {
                // fieldKey arrives prefixed (deal_field_12); custom_fields_data is keyed field_12
                const id = fieldKey.replace(/^deal_field_/, "");
                return {
                    ...prev,
                    custom_fields_data: { ...(prev.custom_fields_data ?? {}), [`field_${id}`]: value },
                };
            }
            return { ...prev, [fieldKey]: value };
        });
    }, [save, setDeal]);

    // Core contact field save (Personal Info editable rows)
    const handleContactFieldSave = useCallback((fieldKey: string, value: any) => {
        save(`contact:${fieldKey}`, value);
        setDeal((prev: any) => ({
            ...prev,
            contact: { ...(prev.contact ?? {}), [fieldKey]: value },
        }));
    }, [save, setDeal]);

    /** Mark / unmark a step as one the customer wouldn't answer. Goes through the
     *  same debounced writer as every field edit, so it retries and flushes with them. */
    const toggleUnanswered = useCallback((stepKey: string, on: boolean) => {
        setUnanswered((prev) => {
            const next = { ...prev };
            if (on) next[stepKey] = true;
            else delete next[stepKey];
            return next;
        });
        save(`unanswered:${stepKey}`, on ? true : null);
    }, [save]);

    const handleQuestionAnswered = useCallback((stepKey: string) => {
        setAnsweredQuestions((prev) => new Set(prev).add(stepKey));
    }, []);

    const handleQuestionCleared = useCallback((stepKey: string) => {
        setAnsweredQuestions((prev) => {
            const next = new Set(prev);
            next.delete(stepKey);
            return next;
        });
    }, []);

    const handleCompleteClick = useCallback(() => {
        // Required steps are a hard gate — unlike the empty-field warning, there is
        // no "finish anyway" past them.
        if (requiredMissing > 0) {
            setConfirmIntent("required");
            return;
        }
        if (allFilled) {
            analysis.complete("auto", 0, flushAll());
        } else {
            setConfirmIntent("complete");
        }
    }, [allFilled, analysis, flushAll, requiredMissing]);

    // Closing raises the same missing-information warning as completing does.
    const requestClose = useCallback(() => {
        if (unfilledCount > 0) setConfirmIntent("close");
        else doClose();
    }, [unfilledCount, doClose]);

    const handleJump = useCallback(
        (id: string) => {
            // Sections past the current step aren't rendered yet — ignore the jump.
            const index = sections.findIndex((s) => s.id === id);
            if (index === -1 || index > currentStep) return;
            setActiveSection(id);
            scrollPanelRef.current?.scrollToSection(id);
        },
        [sections, currentStep],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                if (confirmIntent) {
                    setConfirmIntent(null);
                } else {
                    requestClose();
                }
                return;
            }

            // Left/Right step between sections — but never when the caret is in a
            // text field, and never inside a checkbox/radio group, where the group
            // owns those keys for moving between its own options.
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                if (confirmIntent) return;
                if (isTextEntryFocused()) return;
                const active = document.activeElement as HTMLElement | null;
                if (active?.closest("[data-option-group]")) return;
                e.preventDefault();
                goToStep(currentStep + (e.key === "ArrowRight" ? 1 : -1));
                return;
            }

            if (e.key !== "Tab") return;
            const panel = panelRef.current;
            if (!panel) return;
            const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        },
        [confirmIntent, requestClose, goToStep, currentStep],
    );

    useEffect(() => {
        if (analysis.isOpen) {
            const panel = panelRef.current;
            const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
            first?.focus({ preventScroll: true });
        }
    }, [analysis.isOpen]);

    const leadName = (deal as any).client_name || deal.contact?.client_name || "";

    // Per-step rows for the right rail, resolved the same way the centre renders them.
    //
    // Built off a deferred copy of the value store: the rail can be 100+ rows and
    // rebuilding/re-rendering it on every keystroke is what made typing feel heavy.
    // React keeps the input responsive and repaints the rail at lower priority —
    // it trails by a frame or two, which is invisible for a read-only summary.
    const deferredValues = useDeferredValue(localValues);
    const railGroups = useMemo(
        () => buildRailGroups(sections, fields, leadCustomFields, deferredValues, deal, currentStep + 1),
        [sections, fields, leadCustomFields, deferredValues, deal, currentStep],
    );

    if (!analysis.isOpen || typeof document === "undefined") return null;

    // The script prop is synchronous, so `undefined` means genuinely not loaded —
    // show the shell as its own loading state rather than the category fallback,
    // which would render a structure the real script is about to replace.
    if (analysisScript === undefined) {
        return createPortal(
            <div className="analysis-modal-overlay">
                <div
                    className="analysis-modal-panel"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                >
                    <AnalysisHeaderBar
                        leadName={leadName}
                        isCompleted={false}
                        totalFilled={0}
                        totalFields={0}
                        onMinimize={doClose}
                    />
                    <span id={titleId} className="sr-only">
                        Deal Analysis {leadName}
                    </span>
                    <div className="flex flex-1 min-h-0 items-center justify-center bg-slate-50">
                        <div className="text-center px-6">
                            <div
                                className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
                                aria-hidden
                            />
                            <p className="m-0 text-sm text-slate-600">Loading analysis script…</p>
                        </div>
                    </div>
                </div>
            </div>,
            document.body,
        );
    }

    // Derive per-deal and per-lead slices of localValues for downstream components
    const dealFieldValues = localValues;
    const leadFieldValues = localValues;

    return createPortal(
        <div className="analysis-modal-overlay">
            <div
                ref={panelRef}
                className={`analysis-modal-panel${focusMode ? " analysis-focus" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={handleKeyDown}
                onScroll={(e) => {
                    // The panel must never scroll. It's overflow:hidden, so a stray
                    // focus/scrollIntoView would strand the header off-screen with no
                    // scrollbar to recover. (target check: only self, never children.)
                    if (e.target !== e.currentTarget) return;
                    const el = e.currentTarget;
                    el.scrollTop = 0;
                    el.scrollLeft = 0;
                }}
            >
                {/* Navy header */}
                <AnalysisHeaderBar
                    leadName={leadName}
                    isCompleted={analysis.isCompleted}
                    totalFilled={totalFilled}
                    totalFields={totalFields}
                    subscribeSaving={subscribeSaving}
                    onMinimize={requestClose}
                    trailingActions={
                        <FocusModeButton active={focusMode} onToggle={() => setFocusMode((v) => !v)} />
                    }
                />

                {/* 3-column body */}
                <div className="analysis-3col-body">
                    {/* Left — lead context */}
                    <div className="analysis-3col-left">
                        <AnalysisLeadContextPanel
                            leadCustomFields={leadCustomFields}
                            leadCustomFieldsData={leadFieldValues}
                            onLeadCustomFieldSave={handleLeadFieldSave}
                            onLeadCustomFieldChange={handleFieldChange}
                            onContactFieldSave={handleContactFieldSave}
                            canEdit={canEdit}
                        />
                    </div>

                    {/* Center — scroll panel with all sections */}
                    <div className="analysis-3col-center">
                        <AnalysisScrollPanel
                            ref={scrollPanelRef}
                            sections={visibleSections}
                            currentStep={currentStep}
                            stepCount={sections.length}
                            onPrevStep={() => goToStep(currentStep - 1)}
                            onNextStep={() => goToStep(currentStep + 1)}
                            onComplete={handleCompleteClick}
                            requiredMissing={requiredMissing}
                            isCompleting={analysis.isCompleting}
                            totalMissing={unfilledCount}
                            fields={fields}
                            leadFields={leadCustomFields}
                            localDealFieldValues={dealFieldValues}
                            canEdit={canEdit}
                            numberByKey={numberByKey}
                            sectionProgress={sectionProgress}
                            totalFilled={totalFilled}
                            totalFields={totalFields}
                            onFieldUpdate={handleScriptFieldSave}
                            onFieldChange={handleFieldChange}
                            unanswered={unanswered}
                            customFieldVisibility={customFieldVisibility}
                            filledSteps={filledSteps}
                            answeredQuestions={answeredQuestions}
                            onToggleUnanswered={toggleUnanswered}
                            onQuestionAnswered={handleQuestionAnswered}
                            onQuestionCleared={handleQuestionCleared}
                            onActiveSectionChange={setActiveSection}
                        />
                    </div>

                    {/* Right — script steps / captured answers + Complete */}
                    <div className="analysis-3col-right analysis-3col-right--wide">
                        <AnalysisRightRail
                            groups={railGroups}
                            activeSection={activeSection}
                            onJump={handleJump}
                            totalFilled={totalFilled}
                            totalFields={totalFields}
                            allFilled={allFilled}
                            requiredMissing={requiredMissing}
                            reachedEnd={currentStep >= sections.length - 1}
                            isCompleting={analysis.isCompleting}
                            onComplete={handleCompleteClick}
                            tab={railTab}
                            onTabChange={setRailTab}
                        />
                    </div>
                </div>

                {/* Failed-save retry banner */}
                {failedKeys.length > 0 && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 12,
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "#fff",
                            border: "1px solid #fca5a5",
                            borderRadius: 8,
                            padding: "8px 14px",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            zIndex: 40,
                            maxWidth: 380,
                        }}
                    >
                        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-slate-700 flex-1">
                            {failedKeys.length} {failedKeys.length === 1 ? "field" : "fields"} {"couldn't save"} —{" "}
                            <button
                                type="button"
                                className="underline font-medium text-slate-800"
                                onClick={() => failedKeys.forEach((f) => retry(f.key))}
                            >
                                {"Retry"}
                            </button>
                        </span>
                        <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600"
                            onClick={() => failedKeys.forEach((f) => dismissError(f.key))}
                            aria-label={t("pages.deals.common.dismiss")}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Missing-information warning — raised by both Complete and Close */}
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
                            <div style={{ fontSize: 44, marginBottom: 16 }}>⚠️</div>
                            <h3
                                style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: T.TEXT,
                                    marginBottom: 10,
                                    lineHeight: 1.3,
                                }}
                            >
                                {confirmIntent === "required"
                                    ? td("Required steps still open", { source: "en" })
                                    : td("Finish with missing information?", { source: "en" })}
                            </h3>
                            <p
                                style={{
                                    fontSize: 14,
                                    color: T.TEXT_MUTED,
                                    marginBottom: 28,
                                    lineHeight: 1.6,
                                }}
                            >
                                {confirmIntent === "required" ? (
                                    <>
                                        <strong style={{ color: T.TEXT }}>
                                            {requiredMissing}{" "}
                                            {td(
                                                requiredMissing === 1 ? "required step" : "required steps",
                                                { source: "en" },
                                            )}
                                        </strong>{" "}
                                        {td(
                                            requiredMissing === 1
                                                ? "has no answer yet. Answer it, or mark it as “No answer provided”, to finish."
                                                : "have no answer yet. Answer them, or mark them as “No answer provided”, to finish.",
                                            { source: "en" },
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <strong style={{ color: T.TEXT }}>
                                            {unfilledCount}{" "}
                                            {unfilledCount === 1
                                                ? "field is still empty"
                                                : "fields are still empty"}
                                        </strong>
                                        .{" "}
                                        {confirmIntent === "complete"
                                            ? "Completing now will mark this analysis as done, but the missing data won't be captured."
                                            : "You can reopen the analysis later to fill in the rest."}
                                    </>
                                )}
                            </p>
                            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                                <button
                                    type="button"
                                    className="dr-btn dr-btn-ghost"
                                    onClick={() => setConfirmIntent(null)}
                                >
                                    {td(
                                        confirmIntent === "required"
                                            ? "Back to the script"
                                            : "Go back and fill in",
                                        { source: "en" },
                                    )}
                                </button>
                                {/* No escape hatch for required steps — that is the point of them. */}
                                {confirmIntent !== "required" && (
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-primary"
                                        disabled={analysis.isCompleting}
                                        style={{ background: T.NAVY }}
                                        onClick={() => {
                                            const intent = confirmIntent;
                                            setConfirmIntent(null);
                                            if (intent === "complete") analysis.complete("manual", unfilledCount, flushAll());
                                            else doClose();
                                        }}
                                    >
                                        {confirmIntent === "complete" ? "Finish anyway" : "Close anyway"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>,
        document.body,
    );
}

/** Header toggle for focus mode — labelled, since it changes the whole layout. */
function FocusModeButton({ active, onToggle }: { active: boolean; onToggle: () => void }) {
    const { td } = useTd();

    return (
        <button
            type="button"
            aria-pressed={active}
            title={
                active
                    ? td("Restore the side panels", { source: "en" })
                    : td("Hide the side panels and narrow the modal", { source: "en" })
            }
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
                color: active ? "#fff" : "rgba(255,255,255,0.7)",
                backgroundColor: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.24)";
                (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = active
                    ? "rgba(255,255,255,0.16)"
                    : "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.color = active ? "#fff" : "rgba(255,255,255,0.7)";
            }}
        >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {active ? (
                    // Arrows pointing out — click to bring the panels back
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20H4v-5m0 5l6-6m5-9h5v5m0-5l-6 6" />
                ) : (
                    // Arrows pointing in — click to collapse the panels
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 14h5v5m-5 0l6-6m10-4h-5V4m5 0l-6 6" />
                )}
            </svg>
            {active ? td("Exit focus mode", { source: "en" }) : td("Focus mode", { source: "en" })}
        </button>
    );
}
