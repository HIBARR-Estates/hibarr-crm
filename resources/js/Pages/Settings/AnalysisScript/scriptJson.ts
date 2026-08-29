import { ANALYSIS_FIELD_META, type AnalysisFieldMeta } from "@/Pages/Deals/Redesign/config/analysisFieldMeta";
import type { PaletteCategory, PaletteCustomField } from "./FieldPalette";
import { makeKey, type BuilderRow, type BuilderSection, type ScriptItemType } from "./types";

/**
 * The JSON interchange format for an analysis script: the same shape the builder
 * edits, minus the client-only dnd keys. Exported with a `reference` block listing
 * every live key/id so a hand-written file can be checked against what the system
 * actually has before it is imported.
 */

/** Row types that live inside a section (sections themselves are not rows). */
const ROW_TYPES = [
    "question",
    "instruction",
    "native_field",
    "hibarr_field",
    "lead_field",
    "deal_custom_field",
    "lead_custom_field",
] as const;

type RowType = (typeof ROW_TYPES)[number];

const isPrompt = (t: string) => t === "question" || t === "instruction";

export interface JsonRow {
    type: RowType;
    /** Field key/id. Required for field rows, ignored for question/instruction. */
    key?: string;
    /** Label override; null keeps the field's own label. Ignored for prompts. */
    label?: string | null;
    /** Prompts: the question/instruction text. Fields: agent talking points. */
    text?: string | null;
}

export interface JsonSection {
    kind?: "custom" | "category";
    title?: string | null;
    description?: string | null;
    /** `category` sections only — expands to every field in the category. */
    categoryId?: number;
    /** `custom` sections only. */
    rows?: JsonRow[];
}

export interface ScriptJson {
    version: number;
    sections: JsonSection[];
    reference?: unknown;
}

export interface ScriptCatalog {
    dealCustomFields: PaletteCustomField[];
    leadCustomFields: PaletteCustomField[];
    categories: PaletteCategory[];
}

const sourceType = (meta: AnalysisFieldMeta): ScriptItemType =>
    meta.source === "deal" ? "native_field" : meta.source === "hibarrFields" ? "hibarr_field" : "lead_field";

const metaEntries = (type: ScriptItemType) =>
    Object.entries(ANALYSIS_FIELD_META)
        .filter(([, meta]) => sourceType(meta) === type)
        .map(([key, meta]) => ({ key, label: meta.label, fieldType: meta.fieldType }));

// -- Export -------------------------------------------------------------------

function reference(catalog: ScriptCatalog) {
    const customFields = (fields: PaletteCustomField[]) =>
        fields.map((f) => ({
            key: String(f.id),
            label: f.label,
            fieldType: f.type,
            category: f.category_name,
        }));

    return {
        rowTypes: [...ROW_TYPES],
        sectionKinds: ["custom", "category"],
        nativeFields: metaEntries("native_field"),
        hibarrFields: metaEntries("hibarr_field"),
        leadFields: metaEntries("lead_field"),
        dealCustomFields: customFields(catalog.dealCustomFields),
        leadCustomFields: customFields(catalog.leadCustomFields),
        categories: catalog.categories.map((c) => ({ categoryId: c.id, name: c.name })),
    };
}

/**
 * The downloadable template: one section of every kind and one row of every type,
 * built from this company's real keys so the file it hands out imports as-is. It is
 * deliberately not the pipeline's current script — this is the format spec, and the
 * `reference` block beside it is the list of keys a real file may use.
 */
export function sampleScriptJson(catalog: ScriptCatalog): ScriptJson {
    const rows: JsonRow[] = [
        { type: "instruction", text: "Introduce yourself and confirm you are speaking to the right person." },
        { type: "question", text: "What made you look into this now?" },
    ];

    // One row per field type, skipping any type this company has no key for — a
    // sample that can't be imported is worse than a shorter one.
    const sampleField = (type: RowType, key: string | undefined, label: string | null, text: string | null) => {
        if (key) rows.push({ type, key, label, text });
    };
    sampleField("native_field", metaEntries("native_field")[0]?.key, null, null);
    sampleField("hibarr_field", metaEntries("hibarr_field")[0]?.key, null, "Agent talking points for this step.");
    sampleField("lead_field", metaEntries("lead_field")[0]?.key, null, null);
    sampleField(
        "deal_custom_field",
        catalog.dealCustomFields[0] && String(catalog.dealCustomFields[0].id),
        "Optional label override",
        null,
    );
    sampleField("lead_custom_field", catalog.leadCustomFields[0] && String(catalog.leadCustomFields[0].id), null, null);

    const sections: JsonSection[] = [
        {
            kind: "custom",
            title: "Introduction",
            description: "A hand-built section: rows are asked in this order.",
            rows,
        },
    ];

    const category = catalog.categories[0];
    if (category) {
        sections.push({
            kind: "category",
            categoryId: category.id,
            title: category.name,
            description: "A field-group section: expands to every field in the category, so it takes no rows.",
        });
    }

    return { version: 1, sections, reference: reference(catalog) };
}

export function downloadJson(data: unknown, filename: string): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// -- Import -------------------------------------------------------------------

/**
 * Parse an uploaded file into editable sections. Returns every problem found rather
 * than the first, and never returns a partial script — an import that silently drops
 * unrecognised rows is worse than one that refuses.
 */
export function parseScriptJson(
    raw: unknown,
    catalog: ScriptCatalog,
): { sections: BuilderSection[]; errors: string[] } {
    const errors: string[] = [];
    const out: BuilderSection[] = [];

    const root = raw as ScriptJson | null;
    if (!root || typeof root !== "object" || !Array.isArray(root.sections)) {
        return { sections: [], errors: ['Expected an object with a "sections" array.'] };
    }

    root.sections.forEach((section, si) => {
        const at = `sections[${si}]`;
        if (!section || typeof section !== "object") {
            errors.push(`${at}: not an object.`);
            return;
        }

        const kind = section.kind ?? "custom";
        if (kind !== "custom" && kind !== "category") {
            errors.push(`${at}.kind: "${kind}" is not "custom" or "category".`);
            return;
        }

        if (kind === "category") {
            const category = catalog.categories.find((c) => c.id === Number(section.categoryId));
            if (!category) {
                errors.push(
                    `${at}.categoryId: ${JSON.stringify(section.categoryId)} is not a category linked to this pipeline.`,
                );
                return;
            }
            out.push({
                key: makeKey(),
                kind: "category",
                title: section.title || category.name,
                description: section.description ?? null,
                categoryId: category.id,
                rows: [],
            });
            return;
        }

        const rows: BuilderRow[] = [];
        (section.rows ?? []).forEach((row, ri) => {
            const rowAt = `${at}.rows[${ri}]`;
            if (!row || typeof row !== "object") {
                errors.push(`${rowAt}: not an object.`);
                return;
            }
            if (!(ROW_TYPES as readonly string[]).includes(row.type)) {
                errors.push(`${rowAt}.type: "${row.type}" is not one of ${ROW_TYPES.join(", ")}.`);
                return;
            }

            const resolved = resolveRow(row, catalog);
            if ("error" in resolved) {
                errors.push(`${rowAt}: ${resolved.error}`);
                return;
            }
            rows.push(resolved.row);
        });

        out.push({
            key: makeKey(),
            kind: "custom",
            title: section.title || "",
            description: section.description ?? null,
            categoryId: null,
            rows,
        });
    });

    return { sections: errors.length ? [] : out, errors };
}

function resolveRow(row: JsonRow, catalog: ScriptCatalog): { row: BuilderRow } | { error: string } {
    const base = {
        key: makeKey(),
        type: row.type as ScriptItemType,
        label_override: row.label ?? null,
        guide_text: row.text ?? null,
    };

    if (isPrompt(row.type)) {
        return {
            row: {
                ...base,
                item_key: `${row.type === "question" ? "q" : "i"}_${makeKey()}`,
                label_override: null,
                displayLabel: row.type === "question" ? "Question" : "Instruction",
            },
        };
    }

    const key = row.key == null ? "" : String(row.key);
    if (!key) return { error: `"key" is required for a ${row.type} row.` };

    if (row.type === "deal_custom_field" || row.type === "lead_custom_field") {
        const pool = row.type === "deal_custom_field" ? catalog.dealCustomFields : catalog.leadCustomFields;
        const field = pool.find((f) => String(f.id) === key);
        if (!field) return { error: `no ${row.type} exists with key "${key}".` };
        return {
            row: { ...base, item_key: key, displayLabel: field.label, contextLabel: field.category_name },
        };
    }

    const meta = ANALYSIS_FIELD_META[key];
    if (!meta) return { error: `unknown field key "${key}".` };
    if (sourceType(meta) !== row.type) {
        return { error: `field "${key}" is a ${sourceType(meta)}, not a ${row.type}.` };
    }
    return { row: { ...base, item_key: key, displayLabel: meta.label } };
}
