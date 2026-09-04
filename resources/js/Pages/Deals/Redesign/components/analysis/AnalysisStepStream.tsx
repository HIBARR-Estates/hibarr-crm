import { Fragment, useMemo } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { FormField } from "./AnalysisCustomFieldForm";
import AnalysisQuestionRow from "./AnalysisQuestionRow";
import type { AnalysisFlatStep } from "./analysisProgress";
import type { AnalysisSection } from "./types/analysisTypes";

interface Props {
    /** Sections, for the heading that opens each run of steps. */
    sections: AnalysisSection[];
    /** Only the steps revealed so far — the last one is the current step. */
    steps: AnalysisFlatStep[];
    /** Key of the step being asked right now; it gets the highlight. */
    currentKey: string | null;
    /** Merged deal + lead custom field values, keyed `field_{id}`. */
    values: Record<string, any>;
    canEdit: boolean;
    /** Precomputed by computeAnalysisProgress so headings cannot drift from the rail. */
    sectionProgress?: Record<string, { filled: number; total: number }>;
    onFieldUpdate: (fieldKey: string, value: any, updateType: string) => void;
    onFieldChange?: (fieldId: number, value: any) => void;
    /** Step keys marked as "the customer would not answer this". */
    unanswered: Record<string, unknown>;
    /** Step keys that already hold a recorded value, from computeAnalysisProgress. */
    filledSteps: ReadonlySet<string>;
    /** Question steps answered in this session (their answer is saved as a note). */
    answeredQuestions: ReadonlySet<string>;
    onToggleUnanswered: (stepKey: string, on: boolean) => void;
    onQuestionAnswered: (stepKey: string) => void;
    /** Undo a question's saved answer — the note stays, the step reopens. */
    onQuestionCleared: (stepKey: string) => void;
}

/**
 * Footer under a step: its required marker, the "would not answer" escape hatch,
 * and the way to take an answer back. Rendered here rather than inside each input
 * component so every step type — question, native/hibarr/lead field, hand-placed
 * custom field, and a field expanded out of a category — gets the same one.
 * Renders nothing when a step is neither required nor answered.
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
        <div className="flex items-center gap-2 -mt-4 mb-2 pl-11 text-xs">
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

/** The heading that opens each run of steps belonging to one section. */
function SectionHeading({
    section,
    progress,
}: {
    section: AnalysisSection;
    progress?: { filled: number; total: number };
}) {
    const filled = progress?.filled ?? 0;
    const total = progress?.total ?? 0;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

    return (
        <div data-section-id={section.id} className="mb-3 mt-8 first:mt-0">
            <div className="flex items-start justify-between">
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
                                    backgroundColor: pct === 100 ? "#10b981" : "#38bdf8",
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
            <div className="border-t mt-3" style={{ borderColor: T.BORDER }} />
        </div>
    );
}

/**
 * The centre column's body: one step at a time, revealed downward.
 *
 * Everything already asked stays mounted above the current step so the agent can
 * scroll back through the call, but only the current step is highlighted — and the
 * panel keeps it pinned to the top of the view, with nothing rendered under it.
 */
export default function AnalysisStepStream({
    sections,
    steps,
    currentKey,
    values,
    canEdit,
    sectionProgress,
    onFieldUpdate,
    onFieldChange,
    unanswered,
    filledSteps,
    answeredQuestions,
    onToggleUnanswered,
    onQuestionAnswered,
    onQuestionCleared,
}: Props) {
    const sectionById = useMemo(() => {
        const map = new Map<string, AnalysisSection>();
        for (const s of sections) map.set(s.id, s);
        return map;
    }, [sections]);

    /** Wipe a step's recorded answer through the same save path its input uses, so
     *  the value, the deal and the progress counts all follow from one write. */
    const clearAnswer = (step: AnalysisFlatStep) => {
        if (step.kind === "question") {
            // The answer is a saved note — kept as the record of what was said;
            // this just reopens the step so it can be answered again.
            onQuestionCleared(step.key);
            return;
        }
        if (step.field) {
            onFieldChange?.(Number(step.field.id), null);
            onFieldUpdate(
                step.isLead ? `lead_field_${step.field.id}` : `deal_field_${step.field.id}`,
                null,
                step.isLead ? "lead_custom_field" : "custom_field",
            );
            return;
        }
        const itemKey = step.item?.scriptItem.item_key;
        if (!itemKey) return;
        onFieldUpdate(
            itemKey,
            null,
            step.kind === "hibarr_field"
                ? "hibarr_field"
                : step.kind === "lead_field"
                  ? "contact"
                  : "details",
        );
    };

    const renderBody = (step: AnalysisFlatStep) => {
        if (step.field) {
            const field = step.field;
            const labelOverride = step.item?.scriptItem.label_override;
            return (
                <FormField
                    field={labelOverride ? { ...field, label: labelOverride } : field}
                    value={values[`field_${field.id}`] ?? null}
                    fieldNumber={step.number}
                    canEdit={canEdit}
                    onChange={(value) => onFieldChange?.(Number(field.id), value)}
                    onSave={(value) =>
                        onFieldUpdate(
                            step.isLead ? `lead_field_${field.id}` : `deal_field_${field.id}`,
                            value,
                            step.isLead ? "lead_custom_field" : "custom_field",
                        )
                    }
                />
            );
        }

        // A hand-placed custom field whose definition has since been deleted never
        // reaches here — computeAnalysisProgress drops it from the step list.
        if (!step.item) return null;

        return (
            <AnalysisQuestionRow
                item={step.item}
                number={step.number}
                canEdit={canEdit}
                onFieldUpdate={onFieldUpdate}
                onAnswered={() => onQuestionAnswered(step.key)}
                answered={answeredQuestions.has(step.key)}
            />
        );
    };

    return (
        <div>
            {steps.map((step, i) => {
                const previous = steps[i - 1];
                const opensSection = !previous || previous.sectionId !== step.sectionId;
                const section = sectionById.get(step.sectionId);
                const isCurrent = step.key === currentKey;
                const answered =
                    step.kind === "question"
                        ? answeredQuestions.has(step.key)
                        : filledSteps.has(step.key);

                return (
                    <Fragment key={step.key}>
                        {opensSection && section && (
                            <SectionHeading
                                section={section}
                                progress={sectionProgress?.[section.id]}
                            />
                        )}
                        <div
                            data-step-key={step.key}
                            className={`analysis-step${isCurrent ? " analysis-step--current" : ""}`}
                            aria-current={isCurrent ? "step" : undefined}
                        >
                            {renderBody(step)}
                            <StepFooter
                                stepKey={step.key}
                                required={step.required}
                                marked={step.key in unanswered}
                                answered={answered}
                                onToggle={onToggleUnanswered}
                                onClear={() => clearAnswer(step)}
                            />
                        </div>
                    </Fragment>
                );
            })}
        </div>
    );
}
