import type { Lead } from "@/Types/api/leads";
import useLeadQualificationLoader from "@/Pages/Leads/Components/Qualification/useLeadQualificationLoader";

interface UseLeadQualificationWorkspaceOptions {
    enabled?: boolean;
}

export default function useLeadQualificationWorkspace(
    lead: Lead,
    { enabled = true }: UseLeadQualificationWorkspaceOptions = {},
) {
    const loader = useLeadQualificationLoader(lead.id, { enabled });

    const flowActive = loader.enabled && loader.phase === "inProgress";
    const outcome =
        loader.enabled && loader.current?.status === "completed"
            ? loader.current.outcome ?? null
            : null;

    return {
        ...loader,
        flowActive,
        outcome,
    };
}
