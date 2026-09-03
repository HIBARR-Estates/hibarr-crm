import { parseMultiSelectStoredValue } from "./parseMultiSelectStoredValue";

/**
 * Deal-context reserved keys a visibility criterion can read alongside the
 * ordinary `field_<id>` keys. Added to the map only when `context` is passed
 * — omitted entirely for callers that don't (yet) evaluate against a deal.
 */
export interface FieldValueMapContext {
    pipeline?: number | string | null;
    pipelineStage?: number | string | null;
    packageIds?: Array<number | string> | null;
    /** The record (Deal/Lead/...) currently being evaluated — backs a `record`-source criterion ("restrict to specific record(s)"). */
    recordId?: number | string | null;
}

interface FieldLike {
    id: number | string;
    type?: string;
    values?: unknown;
}

export interface BuildFieldValueMapOptions {
    /** Raw stored values, keyed by `field_<id>` or a bare id — e.g. `deal.custom_fields_data`. */
    customFieldsData?: Record<string, unknown> | null;
    /** Field definitions, used only to detect checkbox/multiselect/multiSelectCountry fields when `normalizeMultiSelect` is on. */
    fields?: FieldLike[];
    /**
     * Parse checkbox/multiselect/multiSelectCountry values into trimmed
     * string arrays before evaluation. Off by default — only the two
     * original call sites that always normalized (CustomFieldDisplay,
     * useDealInfoNavigation) opt in; every other caller must stay
     * byte-identical to its pre-existing behaviour.
     */
    normalizeMultiSelect?: boolean;
    context?: FieldValueMapContext;
}

function hasMultiSelectOptions(field: FieldLike): boolean {
    if (field.type === "multiSelectCountry" || field.type === "multiselect") {
        return true;
    }

    if (field.type === "checkbox") {
        if (field.values == null) return false;
        const str = String(field.values).trim();
        return str !== "" && str !== "[]" && str !== "{}";
    }

    return false;
}

/**
 * Build the flat string-keyed value map `evaluateAllFieldsVisibility` /
 * `evaluateFieldVisibility` read criteria values from. One builder for every
 * evaluator call site, so a new value source (deal pipeline, stage, package)
 * is added here once instead of at each of the call sites separately.
 */
export function buildFieldValueMap({
    customFieldsData,
    fields = [],
    normalizeMultiSelect = false,
    context,
}: BuildFieldValueMapOptions): Record<string, unknown> {
    const map: Record<string, unknown> = {};

    if (customFieldsData) {
        const fieldsById = new Map<number, FieldLike>();
        if (normalizeMultiSelect) {
            for (const field of fields) {
                fieldsById.set(Number(field.id), field);
            }
        }

        Object.keys(customFieldsData).forEach((key) => {
            const normalizedKey = key.startsWith("field_") ? key : `field_${key}`;
            let value = customFieldsData[key];

            if (normalizeMultiSelect) {
                const fieldId = parseInt(normalizedKey.replace("field_", ""), 10);
                const matchingField = fieldsById.get(fieldId);
                if (matchingField && hasMultiSelectOptions(matchingField)) {
                    value = parseMultiSelectStoredValue(value);
                }
            }

            map[normalizedKey] = value;
        });
    }

    if (context) {
        if (context.pipeline !== undefined) map.pipeline = context.pipeline;
        if (context.pipelineStage !== undefined) map.pipeline_stage = context.pipelineStage;
        if (context.packageIds !== undefined) map.package = context.packageIds;
        if (context.recordId !== undefined) map.record = context.recordId;
    }

    return map;
}
