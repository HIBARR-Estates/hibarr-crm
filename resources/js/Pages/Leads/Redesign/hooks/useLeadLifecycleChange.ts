import { useCallback, useState } from "react";
import type { Lead } from "@/Types/api/leads";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";
import useLeadFieldUpdate from "./useLeadFieldUpdate";

export interface LeadLifecycleStatusOption {
    id: number;
    key: string;
    label: string;
    label_color?: string | null;
    description?: string | null;
}

/**
 * Patch lifecycle status with an optimistic local update so the header
 * pill / banner flip immediately, then confirm via lead-contact.patch.
 */
export default function useLeadLifecycleChange(
    statuses: LeadLifecycleStatusOption[],
) {
    const { lead, setLead } = useLeadWorkspace();
    const { updateField, updatingField } = useLeadFieldUpdate();
    const [optimisticSaving, setOptimisticSaving] = useState(false);

    const changeStatus = useCallback(
        async (statusKey: string) => {
            const match = statuses.find((status) => status.key === statusKey);
            if (!match) return;
            if (lead.lead_lifecycle_status_id === match.id) return;

            const previous = lead;
            const optimisticStatus = {
                id: match.id,
                key: match.key,
                label: match.label,
                label_color: match.label_color ?? null,
                description: match.description ?? null,
            };

            setOptimisticSaving(true);
            setLead(
                (prev) =>
                    ({
                        ...prev,
                        lead_lifecycle_status_id: match.id,
                        lead_lifecycle_status: optimisticStatus,
                        lifecycleStatus: optimisticStatus,
                    }) as Lead,
            );

            try {
                await updateField("lead_lifecycle_status_id", match.id);
            } catch {
                setLead(previous);
            } finally {
                setOptimisticSaving(false);
            }
        },
        [lead, setLead, statuses, updateField],
    );

    return {
        changeStatus,
        saving:
            optimisticSaving ||
            updatingField === "lead_lifecycle_status_id",
    };
}
