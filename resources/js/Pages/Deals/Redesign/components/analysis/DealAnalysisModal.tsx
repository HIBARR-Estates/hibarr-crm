import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import type { UseDealAnalysisReturn } from "../../hooks/useDealAnalysis";
import useDealInfoFieldUpdate from "../../hooks/useDealInfoFieldUpdate";
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

function computeSectionProgress(
    section: AnalysisSection,
    fields: any[],
    localDealFieldValues: Record<string, any>,
    deal: any,
): { filled: number; total: number } {
    let filled = 0;
    let total = 0;

    if (section.categoryId !== null) {
        const p = getCustomFieldCategoryProgress(fields, section.categoryId, localDealFieldValues);
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

    return { filled, total };
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
    const scrollPanelRef = useRef<ScrollPanelHandle>(null);
    const titleId = "analysis-modal-title";

    const [localLeadCustomFieldsData, setLocalLeadCustomFieldsData] = useState<
        Record<string, any>
    >(() => (props.leadCustomFieldsData as Record<string, any>) ?? {});
    const [updatingLeadField, setUpdatingLeadField] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<string>("");
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

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

    const leadCustomFieldsRaw = props.leadCustomFields as any[] | null | undefined;
    const isLoadingCustomFields = leadCustomFieldsRaw == null;
    const leadCustomFields: any[] = leadCustomFieldsRaw ?? [];

    useEffect(() => {
        if (props.leadCustomFieldsData) {
            setLocalLeadCustomFieldsData(props.leadCustomFieldsData as Record<string, any>);
        }
    }, [props.leadCustomFieldsData]);

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

    // Sections + per-section progress + totals — all in one memo to avoid cascaded re-renders
    const { sections, sectionProgress, totalFilled, totalFields } = useMemo(() => {
        const sections = adaptScriptItems(scriptItems);

        const sectionProgress: Record<string, { filled: number; total: number }> = {};
        let totalFilled = 0;
        let totalFields = 0;

        for (const section of sections) {
            const p = computeSectionProgress(section, fields, localDealFieldValues, deal);
            sectionProgress[section.id] = p;
            totalFilled += p.filled;
            totalFields += p.total;
        }

        return { sections, sectionProgress, totalFilled, totalFields };
    }, [scriptItems, fields, localDealFieldValues, deal]);

    const unfilledCount = totalFields - totalFilled;
    const allFilled = totalFields > 0 && unfilledCount === 0;

    // Default first section as active when sections load
    useEffect(() => {
        if (sections.length > 0 && !activeSection) {
            setActiveSection(sections[0].id);
        }
    }, [sections, activeSection]);

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
                    setLocalLeadCustomFieldsData((prev) => ({ ...prev, [fieldKey]: value }));
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

    const handleJump = useCallback(
        (id: string) => {
            setActiveSection(id);
            scrollPanelRef.current?.scrollToSection(id);
        },
        [],
    );

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
    const leadName = (deal as any).client_name || deal.contact?.client_name || "";

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
                {/* ── Navy header ── */}
                <AnalysisHeaderBar
                    leadName={leadName}
                    isCompleted={analysis.isCompleted}
                    totalFilled={totalFilled}
                    totalFields={totalFields}
                    onMinimize={analysis.minimize}
                />

                {/* ── 3-column body ── */}
                <div className="analysis-3col-body">
                    {/* Left — lead context */}
                    <div className="analysis-3col-left">
                        <AnalysisLeadContextPanel
                            leadCustomFields={leadCustomFields}
                            leadCustomFieldsData={localLeadCustomFieldsData}
                            isLoadingCustomFields={isLoadingCustomFields}
                            onLeadCustomFieldUpdate={handleLeadCustomFieldUpdate}
                            updatingField={activeUpdatingField ?? undefined}
                            canEdit={canEdit}
                        />
                    </div>

                    {/* Center — scroll panel with all sections */}
                    <div className="analysis-3col-center">
                        <AnalysisScrollPanel
                            ref={scrollPanelRef}
                            sections={sections}
                            fields={fields}
                            localDealFieldValues={localDealFieldValues}
                            canEdit={canEdit}
                            updatingField={activeUpdatingField ?? undefined}
                            totalFilled={totalFilled}
                            totalFields={totalFields}
                            onFieldUpdate={onFieldUpdate}
                            onFieldChange={handleDealFieldChange}
                            onActiveSectionChange={setActiveSection}
                        />
                    </div>

                    {/* Right — section navigator + quick actions */}
                    <div className="analysis-3col-right">
                        <AnalysisSectionNavigator
                            sections={sections}
                            sectionProgress={sectionProgress}
                            activeSection={activeSection}
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

                {/* ── Complete confirmation overlay ── */}
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
