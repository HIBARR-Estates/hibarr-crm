import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import type { Lead } from "@/Types/api/leads";

export interface LeadHeaderData {
    leadName: string;
    leadId: number;
    languages: string[];
    statusLabel: string | null;
    statusColor: string | null;
    statusIsActive: boolean;
    sourceLabel: string | null;
    ownerName: string | null;
    ownerFirstName: string | null;
}

function resolveLanguageLabel(
    code: string,
    options: Array<{ language_code: string; language_name: string }>,
): string {
    const match = options.find(
        (option) =>
            option.language_code.toLowerCase() === code.toLowerCase(),
    );
    return match?.language_name || code;
}

function getOwnerFirstName(name: string | null | undefined): string | null {
    if (!name?.trim()) return null;
    return name.trim().split(/\s+/)[0] ?? null;
}

export default function useLeadHeaderData(lead: Lead): LeadHeaderData {
    const { props } = usePage<any>();
    const languageOptions = (props.languages as Array<{
        language_code: string;
        language_name: string;
    }>) || [];

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

        const statusLabel = lead.lead_lifecycle_status?.label ?? null;
        const statusKey = lead.lead_lifecycle_status?.key?.toLowerCase() ?? "";
        const statusIsActive =
            statusKey.includes("active") ||
            statusLabel?.toLowerCase() === "active";

        const ownerName = lead.lead_owner?.name ?? null;

        return {
            leadName: leadName || `Lead #${lead.id}`,
            leadId: lead.id,
            languages: (lead.languages ?? []).map((code) =>
                resolveLanguageLabel(code, languageOptions),
            ),
            statusLabel,
            statusColor: lead.lead_lifecycle_status?.label_color ?? null,
            statusIsActive,
            sourceLabel:
                lead.lead_source?.type ?? lead.leadSource?.type ?? null,
            ownerName,
            ownerFirstName: getOwnerFirstName(ownerName),
        };
    }, [languageOptions, lead]);
}
