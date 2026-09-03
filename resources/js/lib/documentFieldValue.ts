/**
 * Shared helpers for rendering a custom FILE field as a document slot —
 * used identically by the Deal and Lead redesign document hooks
 * (useDealDocuments, useLeadDocuments, useLeadCrossDealDocuments). Kept in
 * one place so the "is this value actually a file" / "resolve a stored
 * filename to a URL" rules can't drift between the two pages.
 */

const NON_FILE_STRINGS = new Set([
    "no",
    "false",
    "n/a",
    "na",
    "none",
    "pending",
    "yes",
]);

/** Whether a stored custom-field value represents an actual uploaded file, not an empty/placeholder value. */
export function hasUploadedValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as object).length > 0;

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return false;
        if (NON_FILE_STRINGS.has(trimmed.toLowerCase())) return false;
        return true;
    }

    return Boolean(value);
}

/** A record's custom_fields_data, keyed either `field_<id>` or a bare id — with an optional fallback source (e.g. a lead-owned field's value passed in separately from the record's own data). */
export function readCustomFieldValue(
    customFieldsData: Record<string, unknown> | null | undefined,
    fieldId: number,
    fallbackData?: Record<string, unknown>,
): unknown {
    const data = customFieldsData ?? {};
    const key = `field_${fieldId}`;
    if (data[key] !== undefined) return data[key];
    if (data[fieldId] !== undefined) return data[fieldId];
    return fallbackData?.[key];
}

interface LabelableField {
    id: number | string;
    label?: string;
    name?: string;
}

export function normalizeLabel(field: LabelableField): string {
    return field.label?.trim() || field.name?.trim() || `Field ${field.id}`;
}

const IS_URL = /^(https?:\/\/|\/)/i;

/**
 * Resolve a stored file value into a viewable URL. Handles an already-absolute
 * URL/path, a bare stored filename (served from `/user-uploads/<dir>/`), and
 * an array/JSON list of filenames (takes the first). `dir` is the storage
 * subfolder — `hibarr_fields` or `custom_fields`, matching how EditableField /
 * CustomFieldDisplay build their own links.
 */
export function resolveFileUrl(value: unknown, dir: string): string | undefined {
    let filename: string | undefined;

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        if (IS_URL.test(trimmed)) return trimmed;
        if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
            try {
                const parsed = JSON.parse(trimmed);
                const first = Array.isArray(parsed) ? parsed[0] : parsed;
                filename = typeof first === "string" ? first : undefined;
            } catch {
                filename = trimmed;
            }
        } else {
            filename = trimmed;
        }
    } else if (Array.isArray(value) && value.length > 0) {
        filename = typeof value[0] === "string" ? value[0] : undefined;
    }

    if (!filename) return undefined;
    return IS_URL.test(filename) ? filename : `/user-uploads/${dir}/${filename}`;
}
