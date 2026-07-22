import { useMemo } from "react";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";

export interface DealDocumentItem {
    id: string;
    label: string;
    uploaded: boolean;
    source: "hibarr" | "custom" | "attachment";
    /**
     * Field identity for uploading into this slot via
     * `useDealInfoFieldUpdate().handleFieldUpdate`. Absent for "attachment"
     * rows, which are already-uploaded loose files with no slot behind them.
     */
    fieldName?: string;
    updateType?: "hibarr_field" | "custom_field";
    /** Resolved URL of the stored document, when it looks like one. */
    fileUrl?: string;
}

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
    custom_field_category_id?: string | number;
}

const HIBARR_DOCUMENT_FIELDS: Array<{
    key: keyof NonNullable<Deal["hibarr_fields"]>;
    label: string;
}> = [
    { key: "deposit_confirmation", label: "Deposit confirmation" },
    { key: "reservation_agreement", label: "Reservation agreement" },
    { key: "sales_contract", label: "Sales contract" },
];

const NON_FILE_STRINGS = new Set([
    "no",
    "false",
    "n/a",
    "na",
    "none",
    "pending",
    "yes",
]);

function hasUploadedValue(value: unknown): boolean {
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

function readHibarrDocumentValue(
    deal: Deal,
    key: (typeof HIBARR_DOCUMENT_FIELDS)[number]["key"],
): unknown {
    const fields = deal.hibarr_fields;
    if (!fields) return null;

    const urlKey = `${String(key)}_url` as keyof typeof fields;
    const urlValue = fields[urlKey];
    if (hasUploadedValue(urlValue)) return urlValue;

    return fields[key];
}

function readCustomFieldValue(
    deal: Deal,
    fieldId: number,
): unknown {
    const data = deal.custom_fields_data ?? {};
    return data[`field_${fieldId}`] ?? data[fieldId];
}

function normalizeLabel(field: CustomFieldDefinition): string {
    return field.label?.trim() || field.name?.trim() || `Field ${field.id}`;
}

/** A stored value is only linkable when it actually looks like a URL/path. */
function toFileUrl(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return /^(https?:\/\/|\/)/i.test(trimmed) ? trimmed : undefined;
}

export default function useDealDocuments(
    deal: Deal,
    files: DealFile[],
    customFields: CustomFieldDefinition[] = [],
    /**
     * Restricts custom file fields to these category ids — the deal's pipeline
     * categories. Omit to include every custom file field.
     */
    categoryIds?: number[],
) {
    return useMemo(() => {
        const items: DealDocumentItem[] = [];
        const allowedCategories =
            categoryIds && categoryIds.length > 0 ? new Set(categoryIds) : null;

        for (const doc of HIBARR_DOCUMENT_FIELDS) {
            const value = readHibarrDocumentValue(deal, doc.key);
            items.push({
                id: `hibarr-${doc.key}`,
                label: doc.label,
                uploaded: hasUploadedValue(value),
                source: "hibarr",
                fieldName: String(doc.key),
                updateType: "hibarr_field",
                fileUrl: toFileUrl(value),
            });
        }

        for (const field of customFields) {
            if (field.type !== "file") continue;
            if (
                allowedCategories &&
                !allowedCategories.has(Number(field.custom_field_category_id))
            ) {
                continue;
            }
            const value = readCustomFieldValue(deal, field.id);
            items.push({
                id: `custom-${field.id}`,
                label: normalizeLabel(field),
                uploaded: hasUploadedValue(value),
                source: "custom",
                fieldName: `field_${field.id}`,
                updateType: "custom_field",
                fileUrl: toFileUrl(value),
            });
        }

        const knownLabels = new Set(items.map((item) => item.label.toLowerCase()));
        for (const file of files) {
            const label =
                file.description?.trim() ||
                file.filename?.trim() ||
                `File #${file.id}`;
            const normalized = label.toLowerCase();
            if (knownLabels.has(normalized)) continue;

            items.push({
                id: `file-${file.id}`,
                label,
                uploaded: true,
                source: "attachment",
            });
            knownLabels.add(normalized);
        }

        // Counts cover document SLOTS only. Loose attachments are always
        // `uploaded: true`, so including them inflated both halves of the
        // ratio and made "documents complete" drift upward as unrelated files
        // were uploaded.
        const slots = items.filter((item) => item.source !== "attachment");

        return {
            documents: items,
            slots,
            uploadedCount: slots.filter((item) => item.uploaded).length,
            totalCount: slots.length,
        };
    }, [categoryIds, customFields, deal, files]);
}
