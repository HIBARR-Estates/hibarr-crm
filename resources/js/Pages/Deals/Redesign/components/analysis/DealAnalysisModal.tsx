import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import type { UseDealAnalysisReturn } from "../../hooks/useDealAnalysis";
import useDealInfoFieldUpdate from "../../hooks/useDealInfoFieldUpdate";
import { initialsFromName } from "../../adapters/initials";
import { getCustomFieldCategoryProgress } from "./AnalysisCustomFieldForm";
import DealAvatar from "../primitives/DealAvatar";
import AnalysisLeadContextPanel from "./AnalysisLeadContextPanel";
import AnalysisScriptNav, { type ScriptStep } from "./AnalysisScriptNav";
import AnalysisScriptStep, { type AnalysisScriptItem } from "./AnalysisScriptStep";
import AnalysisFooter from "./AnalysisFooter";

interface Props {
    analysis: UseDealAnalysisReturn;
    dealInfoCategories: any[];
    fields: any[];
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
    visibleLeadFieldKeys,
    analysisScript,
    onAddTask,
    onScheduleMeeting,
}: Props) {
    const { deal } = useDealWorkspace();
    const { props } = usePage<any>();
    const { handleFieldUpdate, updatingField, canEdit } = useDealInfoFieldUpdate();
    const { td } = useTd();
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = "analysis-modal-title";

    const [localLeadCustomFieldsData, setLocalLeadCustomFieldsData] = useState<
        Record<string, any>
    >(() => (props.leadCustomFieldsData as Record<string, any>) ?? {});
    const [updatingLeadField, setUpdatingLeadField] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);

    // Optimistic deal custom field values — updated immediately on every field change
    // so progress numbers react without waiting for the server.
    const [localDealFieldValues, setLocalDealFieldValues] = useState<Record<string, any>>(
        () => ({ ...(deal.custom_fields_data ?? {}) }),
    );
    useEffect(() => {
        setLocalDealFieldValues((prev) => ({ ...prev, ...(deal.custom_fields_data ?? {}) }));
    }, [deal.custom_fields_data]);

    const handleDealFieldChange = useCallback((fieldId: number, value: any) => {
        setLocalDealFieldValues((prev) => ({ ...prev, [`field_${fieldId}`]: value }));
    }, []);
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

    // null = deferred prop not yet loaded (show skeleton); [] = loaded, no fields
    const leadCustomFieldsRaw = props.leadCustomFields as any[] | null | undefined;
    const isLoadingCustomFields = leadCustomFieldsRaw == null;
    const leadCustomFields: any[] = leadCustomFieldsRaw ?? [];

    useEffect(() => {
        if (props.leadCustomFieldsData) {
            setLocalLeadCustomFieldsData(
                props.leadCustomFieldsData as Record<string, any>,
            );
        }
    }, [props.leadCustomFieldsData]);

    const scriptItems: AnalysisScriptItem[] = useMemo(() => {
        if (analysisScript?.items?.length) {
            return analysisScript.items;
        }
        return dealInfoCategories.map((cat: any, i: number) => ({
            id: -(cat.id),
            type: "custom_field_category" as const,
            item_key: String(cat.id),
            label_override: cat.name,
            guide_text: null,
            position: i,
        }));
    }, [analysisScript, dealInfoCategories]);

    const stepProgress = useMemo((): ScriptStep[] => {
        return scriptItems.map((item) => {
            let filled = 0;
            let total = 0;

            if (item.type === "custom_field_category") {
                // Only visible, non-file fields count — uses optimistic values so
                // progress updates immediately on change, not after server confirms.
                const progress = getCustomFieldCategoryProgress(
                    fields,
                    parseInt(item.item_key, 10),
                    localDealFieldValues,
                );
                total = progress.total;
                filled = progress.filled;
            } else if (item.type === "native_field") {
                total = 1;
                filled = isFieldFilled((deal as any)[item.item_key]) ? 1 : 0;
            } else if (item.type === "hibarr_field") {
                total = 1;
                filled = isFieldFilled(
                    (deal as any).hibarrFields?.[item.item_key],
                )
                    ? 1
                    : 0;
            } else if (item.type === "lead_field") {
                total = 1;
                filled = isFieldFilled(
                    (deal.contact as any)?.[item.item_key],
                )
                    ? 1
                    : 0;
            }
            // question and instruction: total = 0, not tracked in progress

            return {
                id: String(item.id),
                label: item.label_override || item.item_key,
                filled,
                total,
            };
        });
    }, [scriptItems, fields, deal, localDealFieldValues]);

    const totalFilled = stepProgress.reduce((acc, s) => acc + s.filled, 0);
    const totalFields = stepProgress.reduce((acc, s) => acc + s.total, 0);
    const unfilledCount = totalFields - totalFilled;
    const allFilled = totalFields > 0 && unfilledCount === 0;

    const goTo = useCallback(
        (i: number) =>
            setCurrentStep(Math.max(0, Math.min(scriptItems.length - 1, i))),
        [scriptItems.length],
    );
    const goPrev = useCallback(() => goTo(currentStep - 1), [currentStep, goTo]);
    const goNext = useCallback(() => goTo(currentStep + 1), [currentStep, goTo]);

    const handleLeadCustomFieldUpdate = useCallback(
        async (field: any, value: any) => {
            const fieldKey = `field_${field.id}`;
            setUpdatingLeadField(fieldKey);
            try {
                const resp = await axios.patch(
                    route("deals.gathering.inline_update", { id: deal.id }),
                    { type: "lead_custom_field", data: { [fieldKey]: value } },
                    { headers: { Accept: "application/json" } },
                );
                if (resp.data?.status === "success") {
                    setLocalLeadCustomFieldsData((prev) => ({
                        ...prev,
                        [fieldKey]: value,
                    }));
                }
            } finally {
                setUpdatingLeadField(null);
            }
        },
        [deal.id],
    );

    const onFieldUpdate = useCallback(
        (fieldKey: string, value: any, updateType: string) =>
            handleFieldUpdate(fieldKey, value, updateType as any),
        [handleFieldUpdate],
    );

    const handleCompleteClick = useCallback(() => {
        if (allFilled) {
            analysis.complete("auto", 0);
        } else {
            setShowCompleteConfirm(true);
        }
    }, [allFilled, analysis]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showCompleteConfirm) {
                    setShowCompleteConfirm(false);
                } else {
                    analysis.minimize();
                }
                return;
            }
            if (e.key !== "Tab") return;
            const panel = panelRef.current;
            if (!panel) return;
            const focusable = Array.from(
                panel.querySelectorAll<HTMLElement>(FOCUSABLE),
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        },
        [analysis, showCompleteConfirm],
    );

    useEffect(() => {
        if (analysis.isOpen) {
            const panel = panelRef.current;
            const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
            first?.focus();
        }
    }, [analysis.isOpen]);

    const activeUpdatingField = updatingField ?? updatingLeadField;
    const leadName =
        (deal as any).client_name || deal.contact?.client_name || "";
    const currentItem = scriptItems[currentStep] ?? null;

    if (!analysis.isOpen || typeof document === "undefined") return null;

    return createPortal(
        <div className="analysis-modal-overlay">
            <div
                ref={panelRef}
                className="analysis-modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={handleKeyDown}
            >
                {/* ── Header ── */}
                <div
                    className="flex shrink-0 items-center justify-between gap-3 px-5 py-3.5"
                    style={{ borderBottom: `1px solid ${T.BORDER}` }}
                >
                    <div className="flex min-w-0 items-center gap-3">
                        <DealAvatar size={26} initials={initialsFromName(leadName)} />
                        <h2
                            id={titleId}
                            className="text-[15px] font-semibold"
                            style={{ color: T.TEXT }}
                        >
                            {td("Deal Analysis")}
                            {leadName && (
                                <span
                                    className="font-normal"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {" · "}
                                    {leadName}
                                </span>
                            )}
                        </h2>
                        {analysis.isCompleted && (
                            <span className="dr-pill dr-pill-green">
                                {td("Completed")}
                            </span>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost dr-btn-sm"
                            onClick={onAddTask}
                        >
                            + {td("Task")}
                        </button>
                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost dr-btn-sm"
                            onClick={onScheduleMeeting}
                        >
                            📅 {td("Meeting")}
                        </button>
                        <button
                            type="button"
                            className="dr-btn dr-btn-ghost dr-btn-sm"
                            aria-label={td("Minimize analysis")}
                            onClick={analysis.minimize}
                        >
                            ⊟ {td("Hide")}
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex min-h-0 flex-1">
                    {/* Left panel ~38% */}
                    <div
                        className="flex shrink-0 flex-col overflow-hidden"
                        style={{
                            width: "38%",
                            borderRight: `1px solid ${T.BORDER}`,
                        }}
                    >
                        <AnalysisLeadContextPanel
                            leadCustomFields={leadCustomFields}
                            leadCustomFieldsData={localLeadCustomFieldsData}
                            isLoadingCustomFields={isLoadingCustomFields}
                            onLeadCustomFieldUpdate={handleLeadCustomFieldUpdate}
                            updatingField={activeUpdatingField ?? undefined}
                            canEdit={canEdit}
                        />
                    </div>

                    {/* Right panel — script steps */}
                    <div className="flex min-w-0 flex-1 flex-col">
                        {scriptItems.length === 0 ? (
                            <div
                                className="flex flex-1 flex-col items-center justify-center gap-2"
                                style={{ color: T.TEXT_HINT }}
                            >
                                <p className="text-[14px]">
                                    {td("No analysis steps configured.")}
                                </p>
                                <p className="text-[12px] italic">
                                    {td("Add steps in pipeline settings to get started.")}
                                </p>
                            </div>
                        ) : (
                            <>
                                <AnalysisScriptNav
                                    steps={stepProgress}
                                    current={currentStep}
                                    onSelect={setCurrentStep}
                                    onPrev={goPrev}
                                    onNext={goNext}
                                />
                                <div className="flex-1 overflow-y-auto">
                                    {currentItem && (
                                        <AnalysisScriptStep
                                            key={currentItem.id}
                                            item={currentItem}
                                            fields={fields}
                                            canEdit={canEdit}
                                            updatingField={
                                                activeUpdatingField ?? undefined
                                            }
                                            onFieldUpdate={onFieldUpdate}
                                            onFieldChange={handleDealFieldChange}
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <AnalysisFooter
                    filledCount={totalFilled}
                    totalCount={totalFields}
                    currentStep={currentStep}
                    totalSteps={scriptItems.length}
                    isCompleting={analysis.isCompleting}
                    onPrev={goPrev}
                    onNext={goNext}
                    onComplete={handleCompleteClick}
                />

                {/* ── In-modal complete confirmation overlay (fix #9) ── */}
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
