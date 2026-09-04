import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { isCustomFieldRequired } from "@/lib/customFieldCompletion";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import { buildDealVisibilityContext } from "../../adapters/dealVisibilityContext";
import { adaptScriptItems } from "./adapters/analysisScriptAdapter";
import type {
    AnalysisSection,
    AnalysisScriptItem,
    AnalysisSectionItem,
    AnalysisSectionItemKind,
} from "./types/analysisTypes";

export function isFieldFilled(value: unknown): boolean {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

/** Script item kinds that reference a single custom field by id. */
const CUSTOM_FIELD_KINDS = ["deal_custom_field", "lead_custom_field"] as const;

/**
 * Script items for a deal — the configured analysis script, or one section per
 * deal-info category as a fallback.
 */
export function buildScriptItems(
    analysisScript: { items: AnalysisScriptItem[] } | null | undefined,
    dealInfoCategories: any[],
): AnalysisScriptItem[] {
    if (analysisScript?.items?.length) return analysisScript.items;
    return dealInfoCategories.map((cat: any, i: number) => ({
        id: -cat.id,
        type: "custom_field_category" as const,
        item_key: String(cat.id),
        label_override: cat.name,
        guide_text: null,
        position: i,
    }));
}

/**
 * One answerable (or readable) unit of the script, in the exact order the centre
 * panel reveals them. The stepped flow walks this list one entry at a time, so it
 * carries everything a step needs: what to render, what number it wears, and
 * whether it is required.
 *
 * A field pulled in by a `custom_field_category` section is a step in its own
 * right here — that is what gives it the same required marker, "no answer
 * provided" escape hatch and "clear answer" action as a hand-placed step.
 */
export interface AnalysisFlatStep {
    /** Stable key — `script_{itemId}` or `field_{customFieldId}`. */
    key: string;
    sectionId: string;
    /** Display number, absent for instructions (they capture nothing). */
    number?: number;
    /** From the script item, OR inherited from the custom field definition. */
    required: boolean;
    /** `custom_field` = expanded out of a category section. */
    kind: "custom_field" | AnalysisSectionItemKind;
    /** Resolved custom field definition, for custom-field steps. */
    field?: any;
    /** The script item behind the step, absent for category-expanded fields. */
    item?: AnalysisSectionItem;
    /** Saves route to the lead rather than the deal. */
    isLead: boolean;
}

export interface AnalysisProgress {
    sections: AnalysisSection[];
    /** Every step, flattened in reveal order. */
    steps: AnalysisFlatStep[];
    sectionProgress: Record<string, { filled: number; total: number }>;
    totalFilled: number;
    totalFields: number;
    /** Required steps with neither a value nor an explicit "not answered" mark. */
    requiredMissing: number;
    /** Show-rule result per custom field id. Surfaced so the renderer hides exactly
     *  the fields this function already excluded from the denominator — the two
     *  cannot drift, because it is one evaluation. */
    customFieldVisibility: Record<number, boolean>;
    /** Step keys that already hold a recorded value. */
    filledSteps: Set<string>;
}

/**
 * Label + colour for the Complete button, shared by the right rail and the step
 * footer so the two cannot disagree.
 *
 * Green means "ready": every required step settled AND the agent has stepped
 * through to the last step. Finishing early is still allowed — the button just
 * does not invite it. Until required is clear, the count shown is the outstanding
 * *required* steps, not the optional empties.
 *
 * `reachedEnd` defaults to true for the step footer, which only offers Complete
 * on the last step in the first place.
 */
export function completeButtonState(
    requiredMissing: number,
    missing: number,
    isCompleting: boolean,
    reachedEnd = true,
): { ready: boolean; label: string } {
    const ready = requiredMissing === 0 && reachedEnd;
    if (isCompleting) return { ready, label: "Completing…" };
    if (requiredMissing > 0) {
        return { ready: false, label: `Complete (${requiredMissing} required)` };
    }
    if (missing > 0) return { ready, label: `Complete (${missing} missing)` };
    return { ready, label: "Complete Analysis" };
}

/** Step keys the agent has settled another way — answered a question, or marked
 *  it as one the customer would not answer. */
const NO_RESOLVED: ReadonlySet<string> = new Set();

/** The key a script item is tracked under, in both the flat step list and the
 *  deal's `analysis_unanswered` store. */
export const stepKeyOf = (scriptItemId: number): string => `script_${scriptItemId}`;

/** The key a category-expanded custom field is tracked under. Distinct from
 *  `stepKeyOf` so the same field placed both ways stays two separate steps. */
export const fieldStepKeyOf = (customFieldId: number): string => `field_${customFieldId}`;

/**
 * Sections, the flat step list, per-section progress and global field numbering
 * in one pass.
 *
 * Shared by the analysis modal (fed the in-memory value store) and the deal-view
 * status card (fed saved values) so both report the same denominator — the
 * denominator is always *visible fillable* fields only.
 *
 * `leadFields` is optional so the deal-view status card can omit it; custom field
 * ids are globally unique across the deal and lead groups, so the two sets are
 * simply concatenated for lookup.
 */
export function computeAnalysisProgress(
    scriptItems: AnalysisScriptItem[],
    fields: any[],
    values: Record<string, any>,
    deal: any,
    leadFields: any[] = [],
    resolvedSteps: ReadonlySet<string> = NO_RESOLVED,
): AnalysisProgress {
    const sections = adaptScriptItems(scriptItems);

    const allCustomFields = leadFields.length ? [...fields, ...leadFields] : fields;
    // Full deal context (pipeline, stage, packages, record) plus the stage
    // list, so every source a rule can read resolves the same way it does in
    // the deal view — see buildDealVisibilityContext.
    const dealContext = buildDealVisibilityContext(deal);
    // One pass for every custom field the script might reference individually —
    // conditional fields must not count toward the denominator while hidden.
    const customFieldVisibility = evaluateAllFieldsVisibility(
        allCustomFields,
        buildFieldValueMap({ customFieldsData: values, context: dealContext.valueMap }),
        dealContext.evaluation,
    );
    const customFieldById = new Map<number, any>(
        allCustomFields.map((f: any) => [Number(f.id), f]),
    );

    const sectionProgress: Record<string, { filled: number; total: number }> = {};
    const steps: AnalysisFlatStep[] = [];
    let totalFilled = 0;
    let totalFields = 0;
    let requiredMissing = 0;
    const filledSteps = new Set<string>();
    let counter = 0;

    for (const section of sections) {
        let filled = 0;
        let total = 0;

        // A category section is the whole category — every visible field in it, in
        // order, each one a step in its own right.
        if (section.kind === "category" && section.categoryId !== null) {
            const sectionFields = fields.filter(
                (f: any) => f.custom_field_category_id === section.categoryId && f.type !== "file",
            );
            const visMap = evaluateAllFieldsVisibility(
                sectionFields,
                buildFieldValueMap({ customFieldsData: values, context: dealContext.valueMap }),
                dealContext.evaluation,
            );
            for (const f of sectionFields) {
                if (visMap[f.id] === false) continue;

                counter++;
                const key = fieldStepKeyOf(f.id);

                // Required is inherited from the field definition — the same flag the
                // deal-info sidebar counts by.
                const required = isCustomFieldRequired(f);
                const has = isFieldFilled(values[`field_${f.id}`]);
                total += 1;
                filled += has ? 1 : 0;
                if (has) filledSteps.add(key);
                if (required && !has && !resolvedSteps.has(key)) requiredMissing += 1;

                steps.push({
                    key,
                    sectionId: section.id,
                    number: counter,
                    required,
                    kind: "custom_field",
                    field: f,
                    isLead: false,
                });
            }
        }

        for (const item of section.items) {
            const s = item.scriptItem;
            const key = stepKeyOf(s.id);
            const isCustom = (CUSTOM_FIELD_KINDS as readonly string[]).includes(item.kind);

            let field: any;
            // A script item can force a step required; a custom field also brings its
            // own definition's flag, so either one makes the step required.
            let required = !!s.is_required;

            if (isCustom) {
                field = customFieldById.get(Number(s.item_key));
                // A field that no longer exists, or is hidden by its own show-rules,
                // is not a step at all — no input, no number, no denominator entry.
                if (!field || customFieldVisibility[field.id] === false) continue;
                required = required || isCustomFieldRequired(field);
            }

            // Instructions are guidance to read out, not something to capture.
            const capturing = item.kind !== "instruction";
            if (capturing) counter++;

            // Questions hold no value — they are settled by saving the answer as a
            // note, or by marking them unanswered — so they sit outside the ratio.
            const counts = capturing && item.kind !== "question";
            let has = false;

            if (item.kind === "native_field") {
                has = isFieldFilled(deal?.[s.item_key]);
            } else if (item.kind === "hibarr_field") {
                has = isFieldFilled(deal?.hibarrFields?.[s.item_key]);
            } else if (item.kind === "lead_field") {
                has = isFieldFilled(deal?.contact?.[s.item_key]);
            } else if (isCustom) {
                has = isFieldFilled(values[`field_${field.id}`]);
            }

            if (counts) {
                total += 1;
                filled += has ? 1 : 0;
            }
            if (has) filledSteps.add(key);
            if (capturing && required && !has && !resolvedSteps.has(key)) requiredMissing += 1;

            steps.push({
                key,
                sectionId: section.id,
                number: capturing ? counter : undefined,
                required: capturing && required,
                kind: item.kind,
                field,
                item,
                isLead: item.kind === "lead_custom_field",
            });
        }

        sectionProgress[section.id] = { filled, total };
        totalFilled += filled;
        totalFields += total;
    }

    return {
        sections,
        steps,
        sectionProgress,
        totalFilled,
        totalFields,
        requiredMissing,
        customFieldVisibility,
        filledSteps,
    };
}
