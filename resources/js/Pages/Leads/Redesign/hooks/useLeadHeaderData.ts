import type { Lead } from "@/Types/api/leads";
import { useMemo } from "react";

export interface LeadHeaderData {
    leadName: string;
    leadId: number;
    language: string | null;
    lifecycleLabel: string | null;
    lifecycleColor: string | null;
    sourceLabel: string | null;
    ownerName: string | null;
}

export default function useLeadHeaderData(lead: Lead): LeadHeaderData {
    return useMemo(() => {
        const leadName = [
            lead.salutation_value
                ? lead.salutation_value.charAt(0).toUpperCase() +
                  lead.salutation_value.slice(1)
                : null,
            lead.client_name,
        ]
            .filter(Boolean)
            .join(" ");

        return {
            leadName: leadName || `Lead #${lead.id}`,
            leadId: lead.id,
            language: lead.languages?.[0] ?? null,
            lifecycleLabel: lead.lead_lifecycle_status?.label ?? null,
            lifecycleColor: lead.lead_lifecycle_status?.label_color ?? null,
            sourceLabel:
                lead.lead_source?.type ?? lead.leadSource?.type ?? null,
            ownerName: lead.lead_owner?.name ?? null,
        };
    }, [lead]);
}
