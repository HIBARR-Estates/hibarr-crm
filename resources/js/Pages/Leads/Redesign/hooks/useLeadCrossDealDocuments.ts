import { useMemo } from "react";
import type { CustomField } from "@/Types";
import { buildFieldValueMap } from "@/lib/customFieldValueMap";
import { evaluateAllFieldsVisibility } from "@/lib/customFieldVisibility";
import {
    hasUploadedValue,
    normalizeLabel,
    readCustomFieldValue,
    resolveFileUrl,
} from "@/lib/documentFieldValue";
import { partitionLeadFileFields } from "../adapters/leadFileFieldPartition";
import type { LeadDocumentItem } from "./useLeadDocuments";

interface CustomFieldDefinition {
    id: number;
    label?: string;
    name?: string;
    type?: string;
    show_rule_set?: CustomField["show_rule_set"];
}

interface LeadDeal {
    id: number;
    name?: string;
    created_at?: string;
    lead_pipeline_id?: number | string | null;
    pipeline_stage_id?: number | string | null;
    custom_fields_data?: Record<string, unknown>;
}

interface LeadWithCustomFields {
    custom_fields_data?: Record<string, unknown>;
}

/** Most-recently-created first — `created_at` when present, else the higher id as a proxy. */
function byRecency(a: LeadDeal, b: LeadDeal): number {
    if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return b.id - a.id;
}

/**
 * Two directions of cross-deal file field land here, handled very
 * differently:
 *
 *  - Lead-owned fields gated by pipeline/stage (the "Show for pipeline(s)"
 *    picker) — the value is genuinely the lead's own, shared across every
 *    deal on that lead (uploading from any deal writes straight to the
 *    lead). Deal context only decides *visibility*: the field only renders
 *    here at all when at least one of the lead's deals currently satisfies
 *    its pipeline/stage rule. No dealId/dealName — there's no "which deal"
 *    to point to.
 *  - Deal-owned fields opted into "Show in Lead" — every deal is eligible,
 *    the value genuinely lives on that specific deal's own
 *    custom_fields_data, so this still resolves to one deal (whichever
 *    already has a value, else the most recently created) and tags the
 *    slot with that deal's id/name for the upload target and the "from
 *    <deal>" label.
 *
 * A plain lead-level field with no deal-context rule never reaches this
 * hook at all — see useLeadDocuments, which renders it directly off the
 * lead's own custom_fields_data (no deal, no resolution needed).
 */
export default function useLeadCrossDealDocuments(
    deals: LeadDeal[],
    /** The lead's full custom-field list (not pre-filtered) — this hook partitions out the pipeline-gated ones itself. */
    leadFileFields: CustomFieldDefinition[],
    /** The lead itself — pipeline-gated lead-owned fields read their (shared) value straight off here. */
    lead: LeadWithCustomFields,
    /** Deal-owned FILE fields with "Show in Lead" on — already filtered server-side. */
    dealFileFields: CustomFieldDefinition[],
): LeadDocumentItem[] {
    return useMemo(() => {
        const slots: LeadDocumentItem[] = [];

        const perDealFields = partitionLeadFileFields(leadFileFields).perDeal;
        for (const field of perDealFields) {
            const isEligible = deals.some((deal) => {
                const valueMap = buildFieldValueMap({
                    customFieldsData: deal.custom_fields_data ?? {},
                    fields: [field],
                    normalizeMultiSelect: true,
                    context: {
                        pipeline: deal.lead_pipeline_id,
                        pipelineStage: deal.pipeline_stage_id,
                        recordId: deal.id,
                    },
                });
                const visibilityMap = evaluateAllFieldsVisibility(
                    [field] as unknown as CustomField[],
                    valueMap,
                );
                return visibilityMap[field.id] !== false;
            });
            if (!isEligible) continue;

            const value = readCustomFieldValue(lead.custom_fields_data, field.id);

            slots.push({
                id: `leadfield-${field.id}`,
                label: normalizeLabel(field),
                uploaded: hasUploadedValue(value),
                source: "custom",
                fieldName: `field_${field.id}`,
                updateType: "custom_field",
                fileUrl: resolveFileUrl(value, "custom_fields"),
            });
        }

        if (deals.length > 0) {
            const byRecencyDesc = [...deals].sort(byRecency);

            for (const field of dealFileFields) {
                if (field.type !== "file") continue;

                const dealWithValue = byRecencyDesc.find((deal) =>
                    hasUploadedValue(readCustomFieldValue(deal.custom_fields_data, field.id)),
                );
                const targetDeal = dealWithValue ?? byRecencyDesc[0];
                const value = readCustomFieldValue(targetDeal.custom_fields_data, field.id);

                slots.push({
                    id: `dealfield-${field.id}`,
                    label: normalizeLabel(field),
                    uploaded: hasUploadedValue(value),
                    source: "custom",
                    fieldName: `field_${field.id}`,
                    updateType: "custom_field",
                    fileUrl: resolveFileUrl(value, "custom_fields"),
                    dealId: targetDeal.id,
                    dealName: targetDeal.name,
                });
            }
        }

        return slots;
    }, [deals, leadFileFields, lead.custom_fields_data, dealFileFields]);
}
