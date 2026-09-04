import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import { getCustomFieldCategoryProgress } from "./AnalysisCustomFieldForm";
import { adaptScriptItems } from "./adapters/analysisScriptAdapter";
import type { AnalysisSection, AnalysisScriptItem } from "./types/analysisTypes";

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

export interface AnalysisProgress {
    sections: AnalysisSection[];
    sectionProgress: Record<string, { filled: number; total: number }>;
    totalFilled: number;
    totalFields: number;
    numberByKey: Record<string, number>;
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
 * footer so the two can't disagree.
 *
 * Green means "ready": every required step settled AND the agent has stepped
 * through to the last section. Finishing early is still allowed — the button
 * just doesn't invite it. Until required is clear, the count shown is the
 * outstanding *required* steps, not the optional empties.
 *
 * `reachedEnd` defaults to true for the step footer, which only renders on the
 * last section in the first place.
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
 *  it as one the customer wouldn't answer. */
const NO_RESOLVED: ReadonlySet<string> = new Set();

/** The key a script item is tracked under, in both `numberByKey` and the
 *  deal's `analysis_unanswered` store. */
export const stepKeyOf = (scriptItemId: number): string => `script_${scriptItemId}`;

/**
 * Sections, per-section progress and global field numbering in one pass.
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
    // Deal context so pipeline / pipeline_stage / record-source visibility
    // criteria resolve correctly — matches the context shape built in
    // DealViewRedesign.tsx / useLeadCrossDealDocuments.ts.
    const dealVisibilityContext = {
        pipeline: deal?.lead_pipeline_id,
        pipelineStage: deal?.pipeline_stage_id,
        recordId: deal?.id,
    };
    // One pass for every custom field the script might reference individually —
    // conditional fields must not count toward the denominator while hidden.
    const customFieldVisibility = evaluateAllFieldsVisibility(
        allCustomFields,
        buildFieldValueMap({ customFieldsData: values, context: dealVisibilityContext }),
    );
    const customFieldById = new Map<number, any>(
        allCustomFields.map((f: any) => [Number(f.id), f]),
    );

    const sectionProgress: Record<string, { filled: number; total: number }> = {};
    const numberByKey: Record<string, number> = {};
    let totalFilled = 0;
    let totalFields = 0;
    let requiredMissing = 0;
    const filledSteps = new Set<string>();
    let counter = 0;

    for (const section of sections) {
        // Number deal custom fields first (they render before script items in each section)
        if (section.kind === "category" && section.categoryId !== null) {
            const sectionFields = fields.filter(
                (f: any) => f.custom_field_category_id === section.categoryId && f.type !== "file",
            );
            const visMap = evaluateAllFieldsVisibility(
                sectionFields,
                buildFieldValueMap({ customFieldsData: values, context: dealVisibilityContext }),
            );
            for (const f of sectionFields) {
                if (visMap[f.id] !== false) {
                    counter++;
                    numberByKey[`deal_field_${f.id}`] = counter;
                }
            }
        }

        // Number script items
        for (const item of section.items) {
            if (
                ["question", "native_field", "hibarr_field", "lead_field"].includes(item.kind)
            ) {
                counter++;
                numberByKey[`script_${item.scriptItem.id}`] = counter;
            } else if ((CUSTOM_FIELD_KINDS as readonly string[]).includes(item.kind)) {
                const field = customFieldById.get(Number(item.scriptItem.item_key));
                if (field && customFieldVisibility[field.id] !== false) {
                    counter++;
                    numberByKey[`script_${item.scriptItem.id}`] = counter;
                }
            }
        }

        // Progress for the section
        let filled = 0;
        let total = 0;

        if (section.kind === "category" && section.categoryId !== null) {
            const p = getCustomFieldCategoryProgress(fields, section.categoryId, values);
            filled += p.filled;
            total += p.total;
        }

        for (const item of section.items) {
            // Required is only settable on answerable steps, and a step the agent
            // resolved another way (answered question / marked unanswered) counts.
            const required = !!item.scriptItem.is_required;
            const resolved = resolvedSteps.has(stepKeyOf(item.scriptItem.id));
            const countRequired = (has: boolean) => {
                if (has) filledSteps.add(stepKeyOf(item.scriptItem.id));
                if (required && !has && !resolved) requiredMissing += 1;
            };

            if (item.kind === "native_field") {
                const has = isFieldFilled(deal?.[item.scriptItem.item_key]);
                total += 1;
                filled += has ? 1 : 0;
                countRequired(has);
            } else if (item.kind === "hibarr_field") {
                const has = isFieldFilled(deal?.hibarrFields?.[item.scriptItem.item_key]);
                total += 1;
                filled += has ? 1 : 0;
                countRequired(has);
            } else if (item.kind === "lead_field") {
                const has = isFieldFilled(deal?.contact?.[item.scriptItem.item_key]);
                total += 1;
                filled += has ? 1 : 0;
                countRequired(has);
            } else if (item.kind === "question") {
                // Questions hold no value — they are settled by saving the answer
                // as a note, or by marking them unanswered.
                countRequired(false);
            } else if ((CUSTOM_FIELD_KINDS as readonly string[]).includes(item.kind)) {
                const field = customFieldById.get(Number(item.scriptItem.item_key));
                // A field that no longer exists, or is hidden by its own show-rules,
                // must not inflate the denominator.
                if (!field || customFieldVisibility[field.id] === false) continue;
                const has = isFieldFilled(values[`field_${field.id}`]);
                total += 1;
                filled += has ? 1 : 0;
                countRequired(has);
            }
        }

        sectionProgress[section.id] = { filled, total };
        totalFilled += filled;
        totalFields += total;
    }

    return {
        sections,
        sectionProgress,
        totalFilled,
        totalFields,
        numberByKey,
        requiredMissing,
        customFieldVisibility,
        filledSteps,
    };
}
