import { useCallback, useState } from "react";
import axios from "axios";
import type { AgentOption } from "@/Components/Redesign/primitives/AgentPicker";
import type { FormDataResponse } from "@/Hooks/useFormData";
import useLeadFieldUpdate from "./useLeadFieldUpdate";

interface LeadAgentRecord {
    id: number;
    name: string;
    user?: {
        id: number;
        name: string;
    };
}

async function resolveUserIdFromAgent(agent: AgentOption): Promise<number> {
    const response = await axios.get<FormDataResponse<LeadAgentRecord>>(
        "/account/api/form-data/lead-agents",
        {
            params: {
                search: agent.name,
                paginate: "false",
                per_page: 20,
            },
            headers: { Accept: "application/json" },
        },
    );

    const agents = Array.isArray(response.data?.data) ? response.data.data : [];
    const match =
        agents.find((record) => record.id === agent.id) ??
        agents.find(
            (record) =>
                (record.user?.name ?? record.name).trim() === agent.name.trim(),
        );

    const userId = match?.user?.id;
    if (!userId) {
        throw new Error("Could not resolve lead owner from selected agent");
    }

    return userId;
}

/**
 * AgentPicker selection → patch `lead_owner` (user id). Pass null to unassign.
 */
export default function useLeadOwnerReassign() {
    const { updateField, updatingField } = useLeadFieldUpdate();
    const [pendingAgentId, setPendingAgentId] = useState<number | null>(null);

    const reassign = useCallback(
        async (agent: AgentOption | null) => {
            if (agent === null) {
                await updateField("lead_owner", null);
                return;
            }

            setPendingAgentId(agent.id);
            try {
                const userId = await resolveUserIdFromAgent(agent);
                await updateField("lead_owner", userId);
            } finally {
                setPendingAgentId(null);
            }
        },
        [updateField],
    );

    return {
        reassign,
        pendingAgentId,
        saving: updatingField === "lead_owner",
    };
}
