import { useMemo } from "react";
import type { Deal } from "@/Types/api/deals";
import type { DealFile } from "@/Types/api/file";
import {
    hasUploadedValue,
    normalizeLabel,
    readCustomFieldValue,
    resolveFileUrl,
} from "@/lib/documentFieldValue";

export interface DealDocumentItem {
    id: string;
    label: string;
    uploaded: boolean;
    /** "lead" = a lead-owned field cross-populated here (see FieldModal's "Show in Deal") — rendered in its own "Personal files" section, not the deal's own Documents section. */
    source: "custom" | "lead" | "attachment";
    /**
     * Field identity for uploading into this slot via
     * `useDealInfoFieldUpdate().handleFieldUpdate`. Absent for "attachment"
     * rows, which are already-uploaded loose files with no slot behind them.
     */
    fieldName?: string;
    /**
     * "lead_custom_field" routes the write straight to the lead (see
     * DealUpdateType::LEAD_CUSTOM_FIELD) — used for "lead"-source slots,
     * whose value is genuinely the lead's own, shared across every deal.
     * Plain "custom_field" writes to this deal.
     */
    updateType?: "custom_field" | "lead_custom_field";
    /** Resolved URL of the stored document, when it looks like one. */
    fileUrl?: string;
    /**
     * Set only on the Lead page's cross-deal slots (useLeadCrossDealDocuments)
     * — never on this deal's own slots, which are inherently already "this
     * deal". Used to route an upload/replace to the right deal and (on the
     * Lead Files tab) to group slots by deal — see FilesTab.tsx.
     */
    dealId?: number;
    dealName?: string;
}

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
    custom_field_category_id?: string | number;
    /** Lead-owned FILE fields only — whether this field may appear on a deal's Files tab at all. Defaults to true when absent. */
    show_in_deal?: boolean;
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
    /**
     * Field visibility, keyed by field id — from evaluateAllFieldsVisibility()
     * over this deal's rule sets (pipeline-context included). A file field
     * evaluating to `false` is dropped entirely rather than shown unfilled.
     * Omit to show every matching field unconditionally (pre-visibility-rules
     * behaviour).
     */
    visibilityMap?: Record<number, boolean>,
    /**
     * Lead-owned FILE fields whose pipeline rule matches this deal — one slot
     * on the deal view, same as any other custom file field. Their values
     * live on the lead (shared across every deal on that lead), passed in
     * separately as `leadFileFieldsData` — not on `deal.custom_fields_data`
     * and not in `customFields` directly.
     */
    leadFileFields: CustomFieldDefinition[] = [],
    leadFileFieldsData: Record<string, unknown> = {},
) {
    return useMemo(() => {
        const items: DealDocumentItem[] = [];
        const allowedCategories =
            categoryIds && categoryIds.length > 0 ? new Set(categoryIds) : null;
        const isVisible = (fieldId: number) =>
            !visibilityMap || visibilityMap[fieldId] !== false;

        for (const field of customFields) {
            if (field.type !== "file") continue;
            // A field with no category assigned isn't category-scoped at all
            // (e.g. the HIBARR document fields migrated straight to custom
            // fields with no category) — only gate fields that actually
            // declare one and it isn't in the allowed set.
            if (
                allowedCategories &&
                field.custom_field_category_id != null &&
                !allowedCategories.has(Number(field.custom_field_category_id))
            ) {
                continue;
            }
            if (!isVisible(field.id)) continue;
            const value = readCustomFieldValue(deal.custom_fields_data, field.id);
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

        // Lead-owned file fields cross-populated here (FieldModal's "Show in
        // Deal", gated the same way — typically a `pipeline equals <this
        // deal's pipeline>` rule). Tagged source: "lead" so the Files tab
        // renders these under their own "Personal files" section, separate
        // from this deal's own Documents. Not category-scoped: they aren't
        // part of this deal's own custom_field_category_scopes. The value
        // itself is genuinely the lead's own (shared across every deal on
        // that lead) — updateType: "lead_custom_field" below routes an
        // upload/replace straight to the lead, not this deal.
        for (const field of leadFileFields) {
            if (field.type !== "file") continue;
            if (field.show_in_deal === false) continue;
            if (!isVisible(field.id)) continue;
            // The value genuinely lives on the lead — read leadFileFieldsData
            // first so a null/stale entry on this deal's own custom_fields_data
            // (e.g. a batch fetch that included the key with no value) can't
            // suppress a value that's actually present on the lead.
            const value = readCustomFieldValue(leadFileFieldsData, field.id, deal.custom_fields_data);
            items.push({
                id: `lead-${field.id}`,
                label: normalizeLabel(field),
                uploaded: hasUploadedValue(value),
                source: "lead",
                fieldName: `field_${field.id}`,
                updateType: "lead_custom_field",
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
    }, [categoryIds, customFields, deal, files, visibilityMap, leadFileFields, leadFileFieldsData]);
}
