import { useCallback, useState } from "react";
import axios from "axios";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

type TeamField = "agent_id" | "deal_participant" | "deal_watcher";

export default function useDealTeamMutations(dealId: number) {
    const [savingField, setSavingField] = useState<TeamField | null>(null);
    const { setDeal, deal } = useDealWorkspace();

    const saveTeamField = useCallback(
        async (field: TeamField, value: number | number[] | null) => {
            if (field === "agent_id" && deal.commission_locked) {
                return;
            }
            setSavingField(field);
            try {
                const response = await axios.patch(
                    route("deals.gathering.inline_update", { id: dealId }),
                    {
                        type: "details",
                        data: {
                            [field]:
                                field === "agent_id"
                                    ? (value as number | null)
                                    : (value as number[]),
                        },
                    },
                );
                if (response.data?.status === "success" && response.data?.data) {
                    setDeal(response.data.data);
                }
            } finally {
                setSavingField(null);
            }
        },
        [deal.commission_locked, dealId, setDeal],
    );

    const isSaving = (field: TeamField) => savingField === field;

    return {
        saveTeamField,
        isSaving,
        isSavingAny: savingField !== null,
    };
}
