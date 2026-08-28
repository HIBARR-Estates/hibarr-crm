import type { AnalysisScriptItem } from "@/Pages/Deals/Redesign/components/analysis/types/analysisTypes";

export type ScriptItemType = AnalysisScriptItem["type"];

/**
 * One step inside a section. `key` is a client-only stable id for React/dnd-kit —
 * the backend doesn't need it (position is derived from array order on save).
 * `displayLabel`/`contextLabel` are resolved at add-time so a row can render its
 * own badge without re-looking-up its source.
 */
export interface BuilderRow {
    key: string;
    type: ScriptItemType;
    item_key: string;
    label_override: string | null;
    guide_text: string | null;
    displayLabel: string;
    /** e.g. the custom field's category, shown as secondary context. */
    contextLabel?: string | null;
}

/**
 * A section is either hand-built ("custom" — holds an ordered list of rows) or a
 * whole custom field category ("category" — auto-expands to every field in it and
 * therefore holds no rows of its own).
 */
export interface BuilderSection {
    key: string;
    kind: "custom" | "category";
    title: string;
    description: string | null;
    /** category kind only */
    categoryId: number | null;
    rows: BuilderRow[];
}

export const makeKey = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `k_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/** Types that open a section rather than sit inside one. */
const BOUNDARY_TYPES: ScriptItemType[] = ["section", "custom_field_category"];

/**
 * Flat saved items -> editable sections. Items appearing before any boundary are
 * wrapped in a "General" section so they remain editable; saving then persists that
 * as a real `section` item.
 */
export function itemsToSections(
    items: AnalysisScriptItem[],
    resolveLabel: (item: AnalysisScriptItem) => { label: string; context?: string | null },
): BuilderSection[] {
    const sections: BuilderSection[] = [];
    let current: BuilderSection | null = null;

    for (const item of items) {
        if (item.type === "custom_field_category") {
            current = {
                key: makeKey(),
                kind: "category",
                title: item.label_override || resolveLabel(item).label,
                description: item.guide_text ?? null,
                categoryId: Number(item.item_key),
                rows: [],
            };
            sections.push(current);
            continue;
        }

        if (item.type === "section") {
            current = {
                key: makeKey(),
                kind: "custom",
                title: item.label_override || "",
                description: item.guide_text ?? null,
                categoryId: null,
                rows: [],
            };
            sections.push(current);
            continue;
        }

        if (!current || current.kind === "category") {
            current = {
                key: makeKey(),
                kind: "custom",
                title: current ? "" : "General",
                description: null,
                categoryId: null,
                rows: [],
            };
            sections.push(current);
        }

        const resolved = resolveLabel(item);
        current.rows.push({
            key: makeKey(),
            type: item.type,
            item_key: item.item_key,
            label_override: item.label_override ?? null,
            guide_text: item.guide_text ?? null,
            displayLabel: resolved.label,
            contextLabel: resolved.context ?? null,
        });
    }

    return sections;
}

/** Editable sections -> the flat ordered payload the upsert endpoint expects. */
export function sectionsToItems(
    sections: BuilderSection[],
): Array<Pick<AnalysisScriptItem, "type" | "item_key" | "label_override" | "guide_text">> {
    const out: Array<Pick<AnalysisScriptItem, "type" | "item_key" | "label_override" | "guide_text">> = [];

    for (const section of sections) {
        if (section.kind === "category") {
            out.push({
                type: "custom_field_category",
                item_key: String(section.categoryId),
                label_override: section.title || null,
                guide_text: section.description || null,
            });
            continue;
        }

        out.push({
            type: "section",
            item_key: section.key,
            label_override: section.title || null,
            guide_text: section.description || null,
        });

        for (const row of section.rows) {
            out.push({
                type: row.type,
                item_key: row.item_key,
                label_override: row.label_override,
                guide_text: row.guide_text,
            });
        }
    }

    return out;
}

export { BOUNDARY_TYPES };
