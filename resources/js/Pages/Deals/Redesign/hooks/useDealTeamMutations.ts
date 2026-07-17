import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import axios from "axios";

type TeamField = "agent_id" | "deal_participant" | "deal_watcher";

export default function useDealTeamMutations(dealId: number) {
    const [savingField, setSavingField] = useState<TeamField | null>(null);

    const saveTeamField = useCallback(
        async (field: TeamField, value: number | number[] | null) => {
            setSavingField(field);
            try {
                await axios.patch(
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
                router.reload({ only: ["deal"] });
            } finally {
                setSavingField(null);
            }
        },
        [dealId],
    );

    const isSaving = (field: TeamField) => savingField === field;

    return {
        saveTeamField,
        isSaving,
        isSavingAny: savingField !== null,
    };
}
