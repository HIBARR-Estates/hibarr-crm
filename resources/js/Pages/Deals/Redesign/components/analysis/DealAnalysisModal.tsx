import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useAnalysisFieldSave from "../../hooks/useAnalysisFieldSave";
import type { UseDealAnalysisReturn } from "../../hooks/useDealAnalysis";
import { getCustomFieldCategoryProgress } from "./AnalysisCustomFieldForm";
import AnalysisLeadContextPanel from "./AnalysisLeadContextPanel";
import AnalysisHeaderBar from "./AnalysisHeaderBar";
import AnalysisScrollPanel, { type ScrollPanelHandle } from "./AnalysisScrollPanel";
import AnalysisSectionNavigator from "./AnalysisSectionNavigator";
import { adaptScriptItems } from "./adapters/analysisScriptAdapter";
import type { AnalysisSection, AnalysisScriptItem } from "./types/analysisTypes";

interface Props {
    analysis: UseDealAnalysisReturn;
    dealInfoCategories: any[];
    fields: any[];
    // ponytail: kept for parent compat, not used here (pipeline scope filtering is server-side)
    visibleLeadFieldKeys?: string[] | null;
    analysisScript?: { items: AnalysisScriptItem[] } | null;
    onAddTask: () => void;
    onScheduleMeeting: () => void;
}

function isFieldFilled(value: unknown): boolean {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DealAnalysisModal({
    analysis,
    dealInfoCategories,
    fields,
    analysisScript,
    onAddTask,
    onScheduleMeeting,
}: Props) {
    const { deal } = useDealWorkspace();
    const { props } = usePage<any>();
    const { td } = useTd();
    const { save, failedKeys, retry, dismissError, flushAll, subscribeSaving } = useAnalysisFieldSave(deal.id);
    const { canEdit } = useDealPermissions(deal);
    const panelRef = useRef<HTMLDivElement>(null);
    const scrollPanelRef = useRef<ScrollPanelHandle>(null);
    const titleId = "analysis-modal-title";

    const [activeSection, setActiveSection] = useState<string>("");
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    // Stepped flow: the centre panel reveals one section at a time. Everything past
    // currentStep stays locked until the footer's Next button advances it.
    const [currentStep, setCurrentStep] = useState(0);
    const lastStep = useRef(-1);

    // Close is never blocked: flushAll() dispatches pending writes right away and
    // minimize() defers the deal reload until they land.
    const requestClose = useCallback(() => {
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

    const leadCustomFields: any[] = (props.leadCustomFields as any[] | null | undefined) ?? [];

    const scriptItems: AnalysisScriptItem[] = useMemo(() => {
        if (analysisScript?.items?.length) return analysisScript.items;
        return dealInfoCategories.map((cat: any, i: number) => ({
            id: -(cat.id),
            type: "custom_field_category" as const,
            item_key: String(cat.id),
            label_override: cat.name,
            guide_text: null,
            position: i,
        }));
    }, [analysisScript, dealInfoCategories]);

    // Sections + progress + global numbering — all in one memo.
    const { sections, sectionProgress, totalFilled, totalFields, numberByKey } = useMemo(() => {
        const sections = adaptScriptItems(scriptItems);

        const sectionProgress: Record<string, { filled: number; total: number }> = {};
        const numberByKey: Record<string, number> = {};
        let totalFilled = 0;
        let totalFields = 0;
        let counter = 0;

        for (const section of sections) {
            // Number deal custom fields first (they render before script items in each section)
            if (section.categoryId !== null) {
                const sectionFields = fields.filter(
                    (f: any) => f.custom_field_category_id === section.categoryId && f.type !== "file",
                );
                const visMap = evaluateAllFieldsVisibility(sectionFields, localValues);
                for (const f of sectionFields) {
                    if (visMap[f.id] !== false) {
                        counter++;
                        numberByKey[`deal_field_${f.id}`] = counter;
                    }
                }
            }

            // Number script items
            for (const item of section.items) {
                if (["question", "native_field", "hibarr_field", "lead_field"].includes(item.kind)) {
                    counter++;
                    numberByKey[`script_${item.scriptItem.id}`] = counter;
                }
            }

            // Progress for the section
            let filled = 0;
            let total = 0;

            if (section.categoryId !== null) {
                const p = getCustomFieldCategoryProgress(fields, section.categoryId, localValues);
                filled += p.filled;
                total += p.total;
            }

            for (const item of section.items) {
                if (item.kind === "native_field") {
                    total += 1;
                    filled += isFieldFilled((deal as any)[item.scriptItem.item_key]) ? 1 : 0;
                } else if (item.kind === "hibarr_field") {
                    total += 1;
                    filled += isFieldFilled((deal as any).hibarrFields?.[item.scriptItem.item_key]) ? 1 : 0;
                } else if (item.kind === "lead_field") {
                    total += 1;
                    filled += isFieldFilled((deal.contact as any)?.[item.scriptItem.item_key]) ? 1 : 0;
                }
            }

            sectionProgress[section.id] = { filled, total };
            totalFilled += filled;
            totalFields += total;
        }

        return { sections, sectionProgress, totalFilled, totalFields, numberByKey };
    }, [scriptItems, fields, localValues, deal]);

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
        if (lastStep.current === currentStep) return;
        const target = sections[currentStep];
        if (!target) return;
        const isFirstRun = lastStep.current === -1;
        lastStep.current = currentStep;
        setActiveSection(target.id);
        if (isFirstRun) return; // don't scroll on open
        const raf = requestAnimationFrame(() =>
            scrollPanelRef.current?.scrollToSection(target.id),
        );
        return () => cancelAnimationFrame(raf);
    }, [currentStep, sections]);

    // Fire-and-forget save for deal custom fields
    const handleDealFieldSave = useCallback((fieldId: number, value: any) => {
        save(`deal_field_${fieldId}`, value);
    }, [save]);

    // Fire-and-forget save for lead custom fields
    const handleLeadFieldSave = useCallback((fieldId: number, value: any) => {
        save(`lead_field_${fieldId}`, value);
    }, [save]);

    // Script item field save — routes by updateType (details, hibarr_field, contact)
    const handleScriptFieldSave = useCallback((fieldKey: string, value: any, updateType: string) => {
        let key: string;
        if (updateType === "hibarr_field") key = `hibarr:${fieldKey}`;
        else if (updateType === "contact") key = `contact:${fieldKey}`;
        else key = fieldKey;
        save(key, value);
    }, [save]);

    // Core contact field save (Personal Info editable rows)
    const handleContactFieldSave = useCallback((fieldKey: string, value: any) => {
        save(`contact:${fieldKey}`, value);
    }, [save]);

    const handleCompleteClick = useCallback(() => {
        if (allFilled) {
            analysis.complete("auto", 0);
        } else {
            setShowCompleteConfirm(true);
        }
    }, [allFilled, analysis]);

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
                if (showCompleteConfirm) {
                    setShowCompleteConfirm(false);
                } else {
                    requestClose();
                }
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
        [showCompleteConfirm, requestClose],
    );

    useEffect(() => {
        if (analysis.isOpen) {
            const panel = panelRef.current;
            const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
            first?.focus({ preventScroll: true });
        }
    }, [analysis.isOpen]);

    const leadName = (deal as any).client_name || deal.contact?.client_name || "";

    if (!analysis.isOpen || typeof document === "undefined") return null;

    // Derive per-deal and per-lead slices of localValues for downstream components
    const dealFieldValues = localValues;
    const leadFieldValues = localValues;

    return createPortal(
        <div className="analysis-modal-overlay">
            <div
                ref={panelRef}
                className="analysis-modal-panel"
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
                            fields={fields}
                            localDealFieldValues={dealFieldValues}
                            canEdit={canEdit}
                            numberByKey={numberByKey}
                            totalFilled={totalFilled}
                            totalFields={totalFields}
                            onFieldUpdate={handleScriptFieldSave}
                            onFieldChange={handleFieldChange}
                            onActiveSectionChange={setActiveSection}
                        />
                    </div>

                    {/* Right — section navigator + quick actions */}
                    <div className="analysis-3col-right">
                        <AnalysisSectionNavigator
                            sections={sections}
                            sectionProgress={sectionProgress}
                            activeSection={activeSection}
                            unlockedCount={currentStep + 1}
                            totalFilled={totalFilled}
                            totalFields={totalFields}
                            isCompleting={analysis.isCompleting}
                            allFilled={allFilled}
                            onJump={handleJump}
                            onScheduleMeeting={onScheduleMeeting}
                            onComplete={handleCompleteClick}
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
                            {failedKeys.length} {failedKeys.length === 1 ? td("field") : td("fields")} {td("couldn't save")} —{" "}
                            <button
                                type="button"
                                className="underline font-medium text-slate-800"
                                onClick={() => failedKeys.forEach((f) => retry(f.key))}
                            >
                                {td("Retry")}
                            </button>
                        </span>
                        <button
                            type="button"
                            className="text-slate-400 hover:text-slate-600"
                            onClick={() => failedKeys.forEach((f) => dismissError(f.key))}
                            aria-label="Dismiss"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* Complete confirmation overlay */}
                {showCompleteConfirm && (
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
                                {td("Finish with missing information?")}
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
                                        ? td("field is still empty")
                                        : td("fields are still empty")}
                                </strong>
                                .{" "}
                                {td(
                                    "Completing now will mark this analysis as done, but the missing data won't be captured.",
                                )}
                            </p>
                            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                                <button
                                    type="button"
                                    className="dr-btn dr-btn-ghost"
                                    onClick={() => setShowCompleteConfirm(false)}
                                >
                                    {td("Go back and fill in")}
                                </button>
                                <button
                                    type="button"
                                    className="dr-btn dr-btn-primary"
                                    disabled={analysis.isCompleting}
                                    style={{ background: T.NAVY }}
                                    onClick={() => {
                                        setShowCompleteConfirm(false);
                                        analysis.complete("manual", unfilledCount);
                                    }}
                                >
                                    {td("Finish anyway")}
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
