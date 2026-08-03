import { useMemo } from "react";
import type { Lead } from "@/Types/api/leads";

export interface LeadDocumentItem {
    id: string;
    label: string;
    uploaded: boolean;
    source: "custom";
    fieldName: string;
    updateType: "custom_field";
    fileUrl?: string;
}

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
}

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

function readCustomFieldValue(lead: Lead, fieldId: number): unknown {
    const data = lead.custom_fields_data ?? {};
    return data[`field_${fieldId}`] ?? data[fieldId];
}

function normalizeLabel(field: CustomFieldDefinition): string {
    return field.label?.trim() || field.name?.trim() || `Field ${field.id}`;
}

const IS_URL = /^(https?:\/\/|\/)/i;

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

/**
 * Document slots for the lead Files tab — every lead custom field with
 * type === "file". No HIBARR fixed docs (those are deal-only).
 */
export default function useLeadDocuments(
    lead: Lead,
    customFields: CustomFieldDefinition[] = [],
) {
    return useMemo(() => {
        const slots: LeadDocumentItem[] = [];

        for (const field of customFields) {
            if (field.type !== "file") continue;
            const value = readCustomFieldValue(lead, field.id);
            slots.push({
                id: `custom-${field.id}`,
                label: normalizeLabel(field),
                uploaded: hasUploadedValue(value),
                source: "custom",
                fieldName: `field_${field.id}`,
                updateType: "custom_field",
                fileUrl: resolveFileUrl(value, "custom_fields"),
            });
        }

        return {
            slots,
            uploadedCount: slots.filter((item) => item.uploaded).length,
            totalCount: slots.length,
        };
    }, [customFields, lead]);
}
