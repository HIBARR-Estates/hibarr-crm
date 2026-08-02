import { useCallback } from "react";
import useLeadFieldUpdate from "./useLeadFieldUpdate";

export interface LeadLifecycleStatusOption {
    id: number;
    key: string;
    label: string;
}

/**
 * Patch lifecycle status immediately — no confirmation step.
 */
export default function useLeadLifecycleChange(
    statuses: LeadLifecycleStatusOption[],
) {
    const { updateField, updatingField } = useLeadFieldUpdate();

    const changeStatus = useCallback(
        async (statusKey: string) => {
            const match = statuses.find((status) => status.key === statusKey);
            if (!match) return;
            await updateField("lead_lifecycle_status_id", match.id);
        },
        [statuses, updateField],
    );

    return {
        changeStatus,
        saving: updatingField === "lead_lifecycle_status_id",
    };
}
