import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import type { UseDealAnalysisReturn } from "../../hooks/useDealAnalysis";
import useDealInfoFieldUpdate from "../../hooks/useDealInfoFieldUpdate";
import { initialsFromName } from "../../adapters/initials";
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

    const [localLeadCustomFieldsData, setLocalLeadCustomFieldsData] = useState<
        Record<string, any>
    >(() => (props.leadCustomFieldsData as Record<string, any>) ?? {});
    const [updatingLeadField, setUpdatingLeadField] = useState<string | null>(null);
    const [currentStep, setCurrentStep] = useState(0);

    const leadCustomFields: any[] = (props.leadCustomFields as any[]) ?? [];

    useEffect(() => {
        if (props.leadCustomFieldsData) {
            setLocalLeadCustomFieldsData(props.leadCustomFieldsData as Record<string, any>);
        }
    }, [props.leadCustomFieldsData]);

    // Build script steps: from analysisScript if configured, else fall back to categories
    const scriptItems: AnalysisScriptItem[] = useMemo(() => {
        if (analysisScript?.items?.length) {
            return analysisScript.items;
        }
        // Fallback: one step per category
        return dealInfoCategories.map((cat: any, i: number) => ({
            id: -(cat.id),
            type: "custom_field_category" as const,
            item_key: String(cat.id),
            label_override: cat.name,
            guide_text: null,
            position: i,
        }));
    }, [analysisScript, dealInfoCategories]);

    // Progress per step
    const stepProgress = useMemo((): ScriptStep[] => {
        return scriptItems.map((item) => {
            let filled = 0;
            let total = 0;

            if (item.type === "custom_field_category") {
                const catId = parseInt(item.item_key, 10);
                const catFields = fields.filter((f: any) => f.custom_field_category_id === catId);
                total = catFields.length;
                filled = catFields.filter((f: any) =>
                    isFieldFilled(deal.custom_fields_data?.[`field_${f.id}`]),
                ).length;
            } else if (item.type === "native_field") {
                total = 1;
                filled = isFieldFilled((deal as any)[item.item_key]) ? 1 : 0;
            } else if (item.type === "hibarr_field") {
                total = 1;
                filled = isFieldFilled((deal as any).hibarrFields?.[item.item_key]) ? 1 : 0;
            } else if (item.type === "lead_field") {
                total = 1;
                filled = isFieldFilled((deal.contact as any)?.[item.item_key]) ? 1 : 0;
            }

            return {
                id: String(item.id),
                label: item.label_override || item.item_key,
                filled,
                total,
            };
        });
    }, [scriptItems, fields, deal]);

    const totalFilled = stepProgress.reduce((acc, s) => acc + s.filled, 0);
    const totalFields = stepProgress.reduce((acc, s) => acc + s.total, 0);

    const goTo = useCallback((i: number) => setCurrentStep(Math.max(0, Math.min(scriptItems.length - 1, i))), [scriptItems.length]);
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

    const activeUpdatingField = updatingField ?? updatingLeadField;
    const leadName = (deal as any).client_name || deal.contact?.client_name || "";
    const currentItem = scriptItems[currentStep] ?? null;

    if (!analysis.isOpen || typeof document === "undefined") return null;

    return createPortal(
        <div className="analysis-modal-overlay">
            <div className="analysis-modal-panel">
                {/* ── Header ── */}
                <div
                    className="flex shrink-0 items-center justify-between gap-3 px-5 py-3"
                    style={{ borderBottom: `1px solid ${T.BORDER}` }}
                >
                    <div className="flex min-w-0 items-center gap-3">
                        <DealAvatar size={26} initials={initialsFromName(leadName)} />
                        <h2
                            className="text-[15px] font-semibold"
                            style={{ color: T.TEXT }}
                        >
                            {td("Deal Analysis")}
                            {leadName && (
                                <span className="font-normal" style={{ color: T.TEXT_MUTED }}>
                                    {" · "}{leadName}
                                </span>
                            )}
                        </h2>
                        {analysis.isCompleted && (
                            <span className="dr-pill dr-pill-green">{td("Completed")}</span>
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
                            onClick={analysis.minimize}
                        >
                            — {td("Minimize")}
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex min-h-0 flex-1">
                    {/* Left panel — lead context ~38% */}
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
                            onLeadCustomFieldUpdate={handleLeadCustomFieldUpdate}
                            updatingField={activeUpdatingField ?? undefined}
                            canEdit={canEdit}
                        />
                    </div>

                    {/* Right panel — script steps */}
                    <div className="flex min-w-0 flex-1 flex-col">
                        {scriptItems.length === 0 ? (
                            <div
                                className="flex flex-1 items-center justify-center"
                                style={{ color: T.TEXT_HINT }}
                            >
                                <p className="text-[13px] italic">
                                    {td("No analysis steps configured for this pipeline.")}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Horizontal scrollable step tabs */}
                                <AnalysisScriptNav
                                    steps={stepProgress}
                                    current={currentStep}
                                    onSelect={setCurrentStep}
                                    onPrev={goPrev}
                                    onNext={goNext}
                                />

                                {/* Scrollable step content */}
                                <div className="flex-1 overflow-y-auto px-7 py-6">
                                    {currentItem && (
                                        <AnalysisScriptStep
                                            key={currentItem.id}
                                            item={currentItem}
                                            fields={fields}
                                            canEdit={canEdit}
                                            updatingField={activeUpdatingField ?? undefined}
                                            onFieldUpdate={onFieldUpdate}
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
                    onComplete={analysis.complete}
                />
            </div>
        </div>,
        document.body,
    );
}
