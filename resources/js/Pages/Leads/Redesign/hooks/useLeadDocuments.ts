import { useMemo } from "react";
import type { Lead } from "@/Types/api/leads";
import type { CustomField } from "@/Types";
import {
    hasUploadedValue,
    normalizeLabel,
    readCustomFieldValue,
    resolveFileUrl,
} from "@/lib/documentFieldValue";
import { isPerDealFileField } from "../adapters/leadFileFieldPartition";

export interface LeadDocumentItem {
    id: string;
    label: string;
    uploaded: boolean;
    source: "custom";
    fieldName: string;
    updateType: "custom_field";
    fileUrl?: string;
    /**
     * Set only for a cross-deal field resolved to a single slot here (see
     * useLeadCrossDealDocuments) — the specific deal an upload/replace must
     * target, since the value actually lives on that deal's own
     * custom_fields_data, not the lead's. Absent for a genuine lead-owned
     * field, which uploads via useLeadDocumentUpload instead.
     */
    dealId?: number;
    /** That deal's name, for the "from <deal>" label next to the slot — set whenever dealId is. */
    dealName?: string;
}

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
    show_rule_set?: CustomField["show_rule_set"];
}

/**
 * Document slots for the lead Files tab — lead custom fields with
 * type === "file" whose visibility rules have no deal context (no
 * 'pipeline' / 'pipeline_stage' criterion). No HIBARR fixed docs (those are
 * deal-only). A field gated by pipeline/stage still resolves to exactly one
 * slot too, just sourced from a specific deal instead of the lead directly
 * — see useLeadCrossDealDocuments.
 */
export default function useLeadDocuments(
    lead: Lead,
    customFields: CustomFieldDefinition[] = [],
) {
    return useMemo(() => {
        const slots: LeadDocumentItem[] = [];

        for (const field of customFields) {
            if (field.type !== "file") continue;
            // A Lead field's own page is implicit/always-on — show_in_lead
            // is only meaningful on a *Deal* field (FieldModal's "Show in
            // Lead" cross-population toggle), never gates a Lead field here.
            if (isPerDealFileField(field)) continue;
            const value = readCustomFieldValue(lead.custom_fields_data, field.id);
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
