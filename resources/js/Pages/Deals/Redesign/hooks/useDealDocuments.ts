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
    /** deposit_confirmation is a free-text field, not an uploaded file, so it
     * has no viewable URL — only the other two are real file uploads. */
    isFile: boolean;
}> = [
    { key: "deposit_confirmation", label: "Deposit confirmation", isFile: false },
    { key: "reservation_agreement", label: "Reservation agreement", isFile: true },
    { key: "sales_contract", label: "Sales contract", isFile: true },
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

const IS_URL = /^(https?:\/\/|\/)/i;

/**
 * Resolve a stored file value into a viewable URL. Handles an already-absolute
 * URL/path, a bare stored filename (served from `/user-uploads/<dir>/`), and
 * an array/JSON list of filenames (takes the first). `dir` is the storage
 * subfolder — `hibarr_fields` or `custom_fields`, matching how EditableField /
 * CustomFieldDisplay build their own links.
 */
function resolveFileUrl(value: unknown, dir: string): string | undefined {
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
            const fields = deal.hibarr_fields;
            const rawValue = fields ? fields[doc.key] : null;
            // The model appends `<key>_url` accessors (HibarrDealFields.php)
            // that resolve the correct href for both local storage
            // (public/user-uploads) and S3 (a signed URL) — authoritative, so
            // we never hand-build the path for hibarr documents.
            const urlValue = fields
                ? (fields as unknown as Record<string, unknown>)[
                      `${String(doc.key)}_url`
                  ]
                : null;
            items.push({
                id: `hibarr-${doc.key}`,
                label: doc.label,
                uploaded: hasUploadedValue(rawValue),
                source: "hibarr",
                fieldName: String(doc.key),
                updateType: "hibarr_field",
                fileUrl:
                    doc.isFile &&
                    typeof urlValue === "string" &&
                    urlValue.trim()
                        ? urlValue
                        : undefined,
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
                fileUrl: resolveFileUrl(value, "custom_fields"),
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
