import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";

/**
 * Merge review (HIB-1120) is gated behind the same permission as the merge
 * action itself (`merge_lead`) plus the `crm.lead-merge` flag — see
 * LeadMergeController::assertFeatureEnabled/assertCanMergeLead.
 */
export default function useLeadMergeAccess(): boolean {
    const { props } = usePage<PageProps>();

    const flagEnabled = props.featureFlags?.["crm.lead-merge"] === true;
    const permission = props.auth?.permissions?.merge_lead;

    return flagEnabled && !!permission && permission !== "none";
}
