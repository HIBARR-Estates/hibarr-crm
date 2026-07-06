import { useMemo } from "react";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";

export interface DealDocumentItem {
    id: string;
    label: string;
    uploaded: boolean;
    source: "hibarr" | "custom" | "attachment";
}

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
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

export default function useDealDocuments(
    deal: Deal,
    files: DealFile[],
    customFields: CustomFieldDefinition[] = [],
) {
    return useMemo(() => {
        const items: DealDocumentItem[] = [];

        for (const doc of HIBARR_DOCUMENT_FIELDS) {
            items.push({
                id: `hibarr-${doc.key}`,
                label: doc.label,
                uploaded: hasUploadedValue(readHibarrDocumentValue(deal, doc.key)),
                source: "hibarr",
            });
        }

        for (const field of customFields) {
            if (field.type !== "file") continue;
            const value = readCustomFieldValue(deal, field.id);
            items.push({
                id: `custom-${field.id}`,
                label: normalizeLabel(field),
                uploaded: hasUploadedValue(value),
                source: "custom",
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

        const uploadedCount = items.filter((item) => item.uploaded).length;

        return {
            documents: items,
            uploadedCount,
            totalCount: items.length,
        };
    }, [customFields, deal, files]);
}
