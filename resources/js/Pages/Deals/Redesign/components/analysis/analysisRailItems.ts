import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import { ANALYSIS_FIELD_META } from "../../config/analysisFieldMeta";
import { formatDisplay, parseOptions } from "./AnalysisCustomFieldRow";
import { isFieldFilled } from "./analysisProgress";
import type { AnalysisSection } from "./types/analysisTypes";

export interface RailStep {
    /** Unique within the rail; used for React keys only. */
    key: string;
    /** Section this step belongs to — what a jump actually targets. */
    sectionId: string;
    title: string;
    filled: boolean;
    /** Formatted captured value, empty when nothing is stored. */
    value: string;
}

export interface RailSectionGroup {
    sectionId: string;
    sectionTitle: string;
    locked: boolean;
    steps: RailStep[];
}

function fieldStep(
    field: any,
    sectionId: string,
    values: Record<string, any>,
    labelOverride?: string | null,
): RailStep {
    const raw = values[`field_${field.id}`];
    return {
        key: `f_${sectionId}_${field.id}`,
        sectionId,
        title: labelOverride || field.label,
        filled: isFieldFilled(raw),
        value: formatDisplay(field.type, raw, parseOptions(field.values)),
    };
}

/**
 * Flattens sections into the per-step rows the right rail lists, resolving each
 * step's label and captured value the same way the centre panel renders it.
 */
export function buildRailGroups(
    sections: AnalysisSection[],
    fields: any[],
    leadFields: any[],
    values: Record<string, any>,
    deal: any,
    unlockedCount: number,
): RailSectionGroup[] {
    const byId = new Map<number, any>();
    for (const f of fields) byId.set(Number(f.id), f);
    for (const f of leadFields) byId.set(Number(f.id), f);

    return sections.map((section, index) => {
        const steps: RailStep[] = [];

        if (section.kind === "category" && section.categoryId !== null) {
            const sectionFields = fields.filter(
                (f: any) =>
                    f.custom_field_category_id === section.categoryId && f.type !== "file",
            );
            const vis = evaluateAllFieldsVisibility(
                sectionFields,
                buildFieldValueMap({ customFieldsData: values }),
            );
            for (const f of sectionFields) {
                if (vis[f.id] === false) continue;
                steps.push(fieldStep(f, section.id, values));
            }
        }

        for (const item of section.items) {
            const s = item.scriptItem;

            // Instructions are guidance for the agent, not a step to capture.
            if (item.kind === "instruction") continue;

            if (item.kind === "question") {
                steps.push({
                    key: `s_${s.id}`,
                    sectionId: section.id,
                    // Prompt body lives in guide_text; older rows put it in label_override.
                    title: s.guide_text || s.label_override || s.item_key,
                    filled: false,
                    value: "",
                });
                continue;
            }

            if (item.kind === "deal_custom_field" || item.kind === "lead_custom_field") {
                const field = byId.get(Number(s.item_key));
                if (!field) continue;
                steps.push(fieldStep(field, section.id, values, s.label_override));
                continue;
            }

            const meta = ANALYSIS_FIELD_META[s.item_key];
            const raw =
                item.kind === "native_field"
                    ? deal?.[s.item_key]
                    : item.kind === "hibarr_field"
                      ? deal?.hibarrFields?.[s.item_key]
                      : deal?.contact?.[s.item_key];

            steps.push({
                key: `s_${s.id}`,
                sectionId: section.id,
                title: s.label_override || meta?.label || s.item_key,
                filled: isFieldFilled(raw),
                // FK columns store an id — read the label off the deal's loaded
                // relation, or the rail would list "3" as the captured answer.
                // meta.options matters for select/radio too: without it a stored
                // value renders raw ("male" instead of "Male").
                value: s.item_key === "category_id"
                    ? String(deal?.category?.category_name ?? "")
                    : meta
                      ? formatDisplay(meta.fieldType, raw, meta.options ?? [])
                      : String(raw ?? ""),
            });
        }

        return {
            sectionId: section.id,
            sectionTitle: section.title,
            locked: index >= unlockedCount,
            steps,
        };
    });
}
