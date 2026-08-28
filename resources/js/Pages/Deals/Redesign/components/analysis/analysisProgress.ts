import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
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
}

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
): AnalysisProgress {
    const sections = adaptScriptItems(scriptItems);

    const allCustomFields = leadFields.length ? [...fields, ...leadFields] : fields;
    // One pass for every custom field the script might reference individually —
    // conditional fields must not count toward the denominator while hidden.
    const customFieldVisibility = evaluateAllFieldsVisibility(allCustomFields, values);
    const customFieldById = new Map<number, any>(
        allCustomFields.map((f: any) => [Number(f.id), f]),
    );

    const sectionProgress: Record<string, { filled: number; total: number }> = {};
    const numberByKey: Record<string, number> = {};
    let totalFilled = 0;
    let totalFields = 0;
    let counter = 0;

    for (const section of sections) {
        // Number deal custom fields first (they render before script items in each section)
        if (section.kind === "category" && section.categoryId !== null) {
            const sectionFields = fields.filter(
                (f: any) => f.custom_field_category_id === section.categoryId && f.type !== "file",
            );
            const visMap = evaluateAllFieldsVisibility(sectionFields, values);
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
            if (item.kind === "native_field") {
                total += 1;
                filled += isFieldFilled(deal?.[item.scriptItem.item_key]) ? 1 : 0;
            } else if (item.kind === "hibarr_field") {
                total += 1;
                filled += isFieldFilled(deal?.hibarrFields?.[item.scriptItem.item_key]) ? 1 : 0;
            } else if (item.kind === "lead_field") {
                total += 1;
                filled += isFieldFilled(deal?.contact?.[item.scriptItem.item_key]) ? 1 : 0;
            } else if ((CUSTOM_FIELD_KINDS as readonly string[]).includes(item.kind)) {
                const field = customFieldById.get(Number(item.scriptItem.item_key));
                // A field that no longer exists, or is hidden by its own show-rules,
                // must not inflate the denominator.
                if (!field || customFieldVisibility[field.id] === false) continue;
                total += 1;
                filled += isFieldFilled(values[`field_${field.id}`]) ? 1 : 0;
            }
        }

        sectionProgress[section.id] = { filled, total };
        totalFilled += filled;
        totalFields += total;
    }

    return { sections, sectionProgress, totalFilled, totalFields, numberByKey };
}
