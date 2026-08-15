import type { FilterOption } from "@/contexts/FilterContext";

export type BulkUpdateControl =
    | "pills"
    | "pills-single"
    | "temperature"
    | "checklist"
    | "checklist-single";

export type BulkUpdateValue =
    | string
    | number
    | boolean
    | Array<string | number>
    | null;

export interface BulkUpdateFieldDef {
    /** Also the field name sent in `fields[]`, which the backend switches on. */
    key: string;
    label: string;
    section: string;
    control: BulkUpdateControl;
    /** Allow explicitly clearing this field (null / empty). */
    clearable: boolean;
    /** Shown under the field label, e.g. "Replaces existing categories". */
    hint?: string;
    options: FilterOption[];
    /** Request body fragment for the drafted value. */
    toPayload: (value: BulkUpdateValue) => Record<string, unknown>;
}

export function asArray(value: BulkUpdateValue): Array<string | number> {
    if (value == null || value === false) return [];
    if (Array.isArray(value)) return value;
    return [value as string | number];
}

export function groupBulkUpdateFieldsBySection(
    fields: BulkUpdateFieldDef[],
): Array<{ name: string; fields: BulkUpdateFieldDef[] }> {
    const grouped = new Map<string, BulkUpdateFieldDef[]>();
    for (const field of fields) {
        if (!grouped.has(field.section)) grouped.set(field.section, []);
        grouped.get(field.section)!.push(field);
    }
    return Array.from(grouped.entries()).map(([name, sectionFields]) => ({
        name,
        fields: sectionFields,
    }));
}
