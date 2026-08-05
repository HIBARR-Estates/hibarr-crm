import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { getCustomFieldCategoryProgress } from "./AnalysisCustomFieldForm";
import { adaptScriptItems } from "./adapters/analysisScriptAdapter";
import type { AnalysisSection, AnalysisScriptItem } from "./types/analysisTypes";

export function isFieldFilled(value: unknown): boolean {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

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
 */
export function computeAnalysisProgress(
    scriptItems: AnalysisScriptItem[],
    fields: any[],
    values: Record<string, any>,
    deal: any,
): AnalysisProgress {
    const sections = adaptScriptItems(scriptItems);

    const sectionProgress: Record<string, { filled: number; total: number }> = {};
    const numberByKey: Record<string, number> = {};
    let totalFilled = 0;
    let totalFields = 0;
    let counter = 0;

    for (const section of sections) {
        // Number deal custom fields first (they render before script items in each section)
        if (section.categoryId !== null) {
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
            if (["question", "native_field", "hibarr_field", "lead_field"].includes(item.kind)) {
                counter++;
                numberByKey[`script_${item.scriptItem.id}`] = counter;
            }
        }

        // Progress for the section
        let filled = 0;
        let total = 0;

        if (section.categoryId !== null) {
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
            }
        }

        sectionProgress[section.id] = { filled, total };
        totalFilled += filled;
        totalFields += total;
    }

    return { sections, sectionProgress, totalFilled, totalFields, numberByKey };
}
