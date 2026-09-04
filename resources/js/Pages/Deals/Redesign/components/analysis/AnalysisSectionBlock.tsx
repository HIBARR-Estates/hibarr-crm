import { forwardRef, useMemo } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import AnalysisCustomFieldForm, { FormField } from "./AnalysisCustomFieldForm";
import AnalysisQuestionRow from "./AnalysisQuestionRow";
import { stepKeyOf } from "./analysisProgress";
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
    /** Step keys marked as "the customer wouldn't answer this". */
    unanswered?: Record<string, unknown>;
    /** Show-rule result per custom field id. A field missing from the map is shown —
     *  only an explicit `false` hides one, matching the category form. */
    customFieldVisibility?: Record<number, boolean>;
    /** Step keys that already hold a recorded value, from computeAnalysisProgress. */
    filledSteps?: ReadonlySet<string>;
    /** Question steps answered in this session (their answer is saved as a note). */
    answeredQuestions: ReadonlySet<string>;
    onToggleUnanswered: (stepKey: string, on: boolean) => void;
    onQuestionAnswered: (stepKey: string) => void;
    /** Undo a question's saved answer — the note stays, the step reopens. */
    onQuestionCleared: (stepKey: string) => void;
}

/** Stable empty default — a deal payload without the column must not crash the page. */
const EMPTY_UNANSWERED: Record<string, unknown> = {};
/** Empty map = nothing hidden, so a missing prop can never blank out the form. */
const EMPTY_VISIBILITY: Record<number, boolean> = {};
const EMPTY_STEPS: ReadonlySet<string> = new Set();

/**
 * Footer under a step: its required marker, the "wouldn't answer" escape hatch,
 * and the way to take an answer back. Rendered here rather than inside each input
 * component so every step type (question, native/hibarr/lead field, custom field)
 * gets the same one. Renders nothing when a step is neither required nor answered.
 */
function StepFooter({
    stepKey,
    required,
    answered,
    marked,
    onToggle,
    onClear,
}: {
    stepKey: string;
    required: boolean;
    /** An answer is recorded for this step. */
    answered: boolean;
    marked: boolean;
    onToggle: (stepKey: string, on: boolean) => void;
    onClear: () => void;
}) {
    const { td } = useTd();
    const link = "font-medium underline-offset-2 hover:underline cursor-pointer";

    // After the hook, so the hook order stays stable across renders.
    if (!required && !answered) return null;

    return (
        <div className="flex items-center gap-2 -mt-4 mb-6 pl-11 text-xs">
            {required && (
                <span
                    className="font-semibold"
                    style={{ color: answered || marked ? "#059669" : "#b45309" }}
                >
                    {answered
                        ? `${td("Required", { source: "en" })} · ${td("answered", { source: "en" })}`
                        : marked
                          ? `${td("Required", { source: "en" })} · ${td("no answer", { source: "en" })}`
                          : td("Required", { source: "en" })}
                </span>
            )}

            {/* The escape hatch is for required steps with nothing recorded — once
                there is an answer there is nothing to excuse, so it disappears. */}
            {required && !answered && (
                <>
                    {<span style={{ color: T.BORDER }}>|</span>}
                    <button
                        type="button"
                        onClick={() => onToggle(stepKey, !marked)}
                        className={link}
                        style={{ color: marked ? "#b45309" : T.TEXT_MUTED }}
                    >
                        {marked
                            ? `${td("No answer provided", { source: "en" })} — ${td("undo", { source: "en" })}`
                            : td("No answer provided", { source: "en" })}
                    </button>
                </>
            )}

            {answered && (
                <>
                    {required && <span style={{ color: T.BORDER }}>|</span>}
                    <button
                        type="button"
                        onClick={onClear}
                        className={link}
                        style={{ color: T.TEXT_MUTED }}
                    >
                        {td("Clear answer", { source: "en" })}
                    </button>
                </>
            )}
        </div>
    );
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
    unanswered = EMPTY_UNANSWERED,
    customFieldVisibility = EMPTY_VISIBILITY,
    filledSteps = EMPTY_STEPS,
    answeredQuestions,
    onToggleUnanswered,
    onQuestionAnswered,
    onQuestionCleared,
}, ref) => {

    // Custom field ids are globally unique across the deal and lead groups.
    const customFieldById = useMemo(() => {
        const map = new Map<number, any>();
        for (const f of fields) map.set(Number(f.id), f);
        for (const f of leadFields) map.set(Number(f.id), f);
        return map;
    }, [fields, leadFields]);

    /** Wipe a step's recorded answer through the same save path its input uses, so
     *  the value, the deal and the progress counts all follow from one write. */
    const clearAnswer = (item: AnalysisSectionItem, stepKey: string) => {
        const key = item.scriptItem.item_key;

        if (item.kind === "question") {
            // The answer is a saved note — kept as the record of what was said;
            // this just reopens the step so it can be answered again.
            onQuestionCleared(stepKey);
            return;
        }
        if (item.kind === "deal_custom_field" || item.kind === "lead_custom_field") {
            const isLead = item.kind === "lead_custom_field";
            onFieldChange?.(Number(key), null);
            onFieldUpdate(
                isLead ? `lead_field_${key}` : `deal_field_${key}`,
                null,
                isLead ? "lead_custom_field" : "custom_field",
            );
            return;
        }
        onFieldUpdate(
            key,
            null,
            item.kind === "hibarr_field" ? "hibarr_field" : item.kind === "lead_field" ? "contact" : "details",
        );
    };

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
                        visibilityMap={customFieldVisibility}
                        numberByKey={numberByKey}
                        onSave={(fieldId, value) =>
                            onFieldUpdate(`deal_field_${fieldId}`, value, "custom_field")
                        }
                        onChange={onFieldChange}
                    />
                )}

                {/* Hand-placed items, in author order */}
                {section.items.map((item, i) => {
                    const stepKey = stepKeyOf(item.scriptItem.id);
                    const marked = stepKey in unanswered;
                    const isCustom =
                        item.kind === "deal_custom_field" || item.kind === "lead_custom_field";

                    // Show-rules apply to a custom field wherever it sits — placed
                    // directly in a hand-built section, exactly as inside a category
                    // section. Hidden means gone: no input, and no required footer,
                    // since computeAnalysisProgress already drops it from the counts.
                    if (
                        isCustom &&
                        customFieldVisibility[Number(item.scriptItem.item_key)] === false
                    ) {
                        return null;
                    }

                    return (
                        <div key={`${item.kind}-${item.scriptItem.id}-${i}`}>
                            {isCustom ? (
                                renderCustomFieldItem(item)
                            ) : (
                                <AnalysisQuestionRow
                                    item={item}
                                    number={numberByKey?.[`script_${item.scriptItem.id}`]}
                                    canEdit={canEdit}
                                    onFieldUpdate={onFieldUpdate}
                                    onAnswered={() => onQuestionAnswered(stepKey)}
                                    answered={answeredQuestions.has(stepKey)}
                                />
                            )}
                            <StepFooter
                                stepKey={stepKey}
                                required={!!item.scriptItem.is_required}
                                marked={marked}
                                answered={
                                    item.kind === "question"
                                        ? answeredQuestions.has(stepKey)
                                        : filledSteps.has(stepKey)
                                }
                                onToggle={onToggleUnanswered}
                                onClear={() => clearAnswer(item, stepKey)}
                            />
                        </div>
                    );
                })}

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
