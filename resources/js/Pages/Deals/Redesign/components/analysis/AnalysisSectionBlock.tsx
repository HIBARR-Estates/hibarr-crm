import { forwardRef, useMemo } from "react";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import AnalysisCustomFieldForm, { FormField } from "./AnalysisCustomFieldForm";
import AnalysisQuestionRow from "./AnalysisQuestionRow";
import type { AnalysisSection, AnalysisSectionItem } from "./types/analysisTypes";

interface Props {
    section: AnalysisSection;
    /** Deal custom fields. */
    fields: any[];
    /** Lead custom fields — needed to resolve `lead_custom_field` steps. */
    leadFields?: any[];
    /** Merged deal + lead custom field values, keyed `field_{id}`. */
    localDealFieldValues: Record<string, any>;
    canEdit: boolean;
    numberByKey?: Record<string, number>;
    /** Precomputed by computeAnalysisProgress so the header can't drift from the rail. */
    progress?: { filled: number; total: number };
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => void;
    onFieldChange?: (fieldId: number, value: any) => void;
}

const AnalysisSectionBlock = forwardRef<HTMLDivElement, Props>(({
    section,
    fields,
    leadFields = [],
    localDealFieldValues,
    canEdit,
    numberByKey,
    progress,
    onFieldUpdate,
    onFieldChange,
}, ref) => {

    // Custom field ids are globally unique across the deal and lead groups.
    const customFieldById = useMemo(() => {
        const map = new Map<number, any>();
        for (const f of fields) map.set(Number(f.id), f);
        for (const f of leadFields) map.set(Number(f.id), f);
        return map;
    }, [fields, leadFields]);

    const filled = progress?.filled ?? 0;
    const total = progress?.total ?? 0;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const complete = total > 0 && pct === 100;
    const isCategory = section.kind === "category";

    /** A single custom field placed directly in a hand-built section. */
    const renderCustomFieldItem = (item: AnalysisSectionItem) => {
        const field = customFieldById.get(Number(item.scriptItem.item_key));
        if (!field) {
            return (
                <p key={item.scriptItem.id} className="text-xs italic text-slate-400 mb-4">
                    {"This field is no longer available."}
                </p>
            );
        }

        const isLead = item.kind === "lead_custom_field";

        return (
            <FormField
                key={`${item.kind}-${item.scriptItem.id}`}
                field={{
                    ...field,
                    label: item.scriptItem.label_override || field.label,
                }}
                value={localDealFieldValues[`field_${field.id}`] ?? null}
                fieldNumber={numberByKey?.[`script_${item.scriptItem.id}`]}
                canEdit={canEdit}
                onChange={(value) => onFieldChange?.(field.id, value)}
                onSave={(value) =>
                    onFieldUpdate(
                        isLead ? `lead_field_${field.id}` : `deal_field_${field.id}`,
                        value,
                        isLead ? "lead_custom_field" : "custom_field",
                    )
                }
            />
        );
    };

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
                {total > 0 && (
                    <div className="shrink-0 flex items-center gap-2 mt-0.5">
                        <span className="text-xs tabular-nums text-slate-500">
                            {filled}/{total}
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
            <div className="border-t pt-4" style={{ borderColor: T.BORDER }}>
                {/* A category section is the whole category — every field in it, in order */}
                {isCategory && section.categoryId !== null && (
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

                {/* Hand-placed items, in author order */}
                {section.items.map((item, i) =>
                    item.kind === "deal_custom_field" || item.kind === "lead_custom_field" ? (
                        renderCustomFieldItem(item)
                    ) : (
                        <AnalysisQuestionRow
                            key={`${item.kind}-${item.scriptItem.id}-${i}`}
                            item={item}
                            number={numberByKey?.[`script_${item.scriptItem.id}`]}
                            canEdit={canEdit}
                            onFieldUpdate={onFieldUpdate}
                        />
                    ),
                )}

                {!isCategory && section.items.length === 0 && (
                    <p className="text-xs italic text-slate-400 py-2">
                        {"No steps in this section."}
                    </p>
                )}
            </div>
        </div>
    );
});

AnalysisSectionBlock.displayName = "AnalysisSectionBlock";
export default AnalysisSectionBlock;
