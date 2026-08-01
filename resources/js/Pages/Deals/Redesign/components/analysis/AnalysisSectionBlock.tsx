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
    updatingField?: string | null;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => Promise<void>;
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
    updatingField,
    onFieldUpdate,
    onFieldChange,
}, ref) => {
    const { deal } = useDealWorkspace();

    const progress = useMemo(() => {
        let filled = 0;
        let total = 0;

        // Custom fields for this section
        if (section.categoryId !== null) {
            const p = getCustomFieldCategoryProgress(fields, section.categoryId, localDealFieldValues);
            filled += p.filled;
            total += p.total;
        }

        // Native/hibarr/lead field items
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
            // question and instruction: not counted
        }

        return { filled, total };
    }, [section, fields, localDealFieldValues, deal]);

    const pct = progress.total > 0 ? Math.round((progress.filled / progress.total) * 100) : 0;
    const complete = progress.total > 0 && pct === 100;

    return (
        <div
            ref={ref}
            data-section-id={section.id}
            className="mb-10"
        >
            {/* Section header */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-4">
                    <h2 className="text-[15px] font-semibold leading-snug" style={{ color: T.NAVY }}>
                        {section.title}
                    </h2>
                    {section.guideText && (
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: T.TEXT_MUTED }}>
                            {section.guideText}
                        </p>
                    )}
                </div>
                {progress.total > 0 && (
                    <div className="shrink-0 flex items-center gap-2 mt-0.5">
                        <span className="text-xs tabular-nums" style={{ color: T.TEXT_MUTED }}>
                            {progress.filled}/{progress.total}
                        </span>
                        <div
                            className="w-14 h-1.5 rounded-full overflow-hidden"
                            style={{ backgroundColor: T.BORDER }}
                        >
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

            <div
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${T.BORDER}`, background: T.SURFACE }}
            >
                {/* Custom fields for this section's category */}
                {section.categoryId !== null && (
                    <div className="px-4 py-3">
                        <AnalysisCustomFieldForm
                            fields={fields}
                            categoryId={section.categoryId}
                            values={localDealFieldValues}
                            canEdit={canEdit}
                            updatingField={updatingField}
                            onSave={(fieldId, value) =>
                                onFieldUpdate(`field_${fieldId}`, value, "custom_field")
                            }
                            onChange={onFieldChange}
                        />
                    </div>
                )}

                {/* Question/instruction/field items */}
                {section.items.length > 0 && (
                    <div
                        className="px-4 py-4"
                        style={
                            section.categoryId !== null
                                ? { borderTop: `1px solid ${T.BORDER_SOFT}` }
                                : {}
                        }
                    >
                        {section.items.map((item, i) => (
                            <AnalysisQuestionRow
                                key={`${item.kind}-${item.scriptItem.id}-${i}`}
                                item={item}
                                canEdit={canEdit}
                                updatingField={updatingField}
                                onFieldUpdate={onFieldUpdate}
                                onFieldChange={onFieldChange}
                            />
                        ))}
                    </div>
                )}

                {section.categoryId !== null && section.items.length === 0 && fields.filter(
                    (f: any) => f.category_id === section.categoryId
                ).length === 0 && (
                    <p className="px-4 py-3 text-xs italic" style={{ color: T.TEXT_HINT }}>
                        No fields configured for this section.
                    </p>
                )}
            </div>
        </div>
    );
});

AnalysisSectionBlock.displayName = "AnalysisSectionBlock";
export default AnalysisSectionBlock;
