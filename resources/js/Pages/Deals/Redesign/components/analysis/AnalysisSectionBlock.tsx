import { forwardRef, useMemo } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import { getCustomFieldCategoryProgress } from "./AnalysisCustomFieldForm";
import AnalysisCustomFieldForm from "./AnalysisCustomFieldForm";
import AnalysisQuestionRow from "./AnalysisQuestionRow";
import type { AnalysisSection } from "./types/analysisTypes";

interface Props {
    section: AnalysisSection;
    fields: any[];
    localDealFieldValues: Record<string, any>;
    canEdit: boolean;
    numberByKey?: Record<string, number>;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => void;
    onFieldChange?: (fieldId: number, value: any) => void;
}

function isFieldFilled(value: unknown): boolean {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

const AnalysisSectionBlock = forwardRef<HTMLDivElement, Props>(({
    section,
    fields,
    localDealFieldValues,
    canEdit,
    numberByKey,
    onFieldUpdate,
    onFieldChange,
}, ref) => {
    const { deal } = useDealWorkspace();

    const progress = useMemo(() => {
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
    }, [section, fields, localDealFieldValues, deal]);

    const pct = progress.total > 0 ? Math.round((progress.filled / progress.total) * 100) : 0;
    const complete = progress.total > 0 && pct === 100;

    return (
        <div ref={ref} data-section-id={section.id} className="mb-10">
            {/* Section header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-4">
                    <h2 className="text-base font-semibold text-slate-900 leading-snug">
                        {section.title}
                    </h2>
                    {section.guideText && (
                        <p className="text-xs mt-0.5 leading-relaxed text-slate-500">
                            {section.guideText}
                        </p>
                    )}
                </div>
                {progress.total > 0 && (
                    <div className="shrink-0 flex items-center gap-2 mt-0.5">
                        <span className="text-xs tabular-nums text-slate-500">
                            {progress.filled}/{progress.total}
                        </span>
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: complete ? "#10b981" : "#38bdf8",
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="border-t border-slate-100 pt-4">
                {/* Custom fields for this section's category */}
                {section.categoryId !== null && (
                    <AnalysisCustomFieldForm
                        fields={fields}
                        categoryId={section.categoryId}
                        values={localDealFieldValues}
                        canEdit={canEdit}
                        numberByKey={numberByKey}
                        onSave={(fieldId, value) =>
                            onFieldUpdate(`deal_field_${fieldId}`, value, "custom_field")
                        }
                        onChange={onFieldChange}
                    />
                )}

                {/* Question/instruction/field items */}
                {section.items.map((item, i) => (
                    <AnalysisQuestionRow
                        key={`${item.kind}-${item.scriptItem.id}-${i}`}
                        item={item}
                        number={numberByKey?.[`script_${item.scriptItem.id}`]}
                        canEdit={canEdit}
                        onFieldUpdate={onFieldUpdate}
                        onFieldChange={onFieldChange}
                    />
                ))}

                {section.categoryId !== null && section.items.length === 0 && fields.filter(
                    (f: any) => f.custom_field_category_id === section.categoryId
                ).length === 0 && (
                    <p className="text-xs italic text-slate-400 py-2">
                        No fields configured for this section.
                    </p>
                )}
            </div>
        </div>
    );
});

AnalysisSectionBlock.displayName = "AnalysisSectionBlock";
export default AnalysisSectionBlock;
