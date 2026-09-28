import { useCallback } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import type { SallyMeetingInsight } from "@/Types/api/sally-meeting-insight";

interface UpdateSummaryPayload {
    summary: string | null;
}

/**
 * The Sally summary is the one field the CRM owns: Sally writes a first
 * version, the team corrects it. Mutations patch the local list so the tab
 * updates in place — no Inertia reload (see DealWorkspaceContext).
 *
 * Per-insight by design: the route is `/sally-insights/{insight}`, so the id
 * has to be bound at hook time. Call it from the card, not the panel.
 */
export default function useSallyInsightMutations(
    insightId: number,
    patch: (insightId: number, summary: string | null) => void,
) {
    const { t } = useTranslation();

    // The lead route is deal-agnostic (an insight is reachable from its lead
    // or from its deal), so it is the one both workspaces use.
    const { mutate: updateMutate, status: updateStatus } = useApiMutate<
        UpdateSummaryPayload,
        Partial<SallyMeetingInsight>,
        ApiResponse<Partial<SallyMeetingInsight>>
    >(route("sally-insights.update", insightId), "PATCH");

    const updateSummary = useCallback(
        (summary: string | null) => {
            if (!insightId) return;
            updateMutate(
                { summary },
                {
                    suppressSuccessToast: true,
                    onSuccess: (response) => {
                        if (response?.status === "success") {
                            message.success(
                                t("pages.deals.sally.messages.updated"),
                            );
                            patch(insightId, response.data?.summary ?? summary);
                        }
                    },
                    onError: () => {
                        message.error(
                            t("pages.deals.sally.messages.update_failed"),
                        );
                    },
                },
            );
        },
        [updateMutate, insightId, patch, t],
    );

    return {
        updateSummary,
        isUpdating: isLoading({ status: updateStatus }),
    };
}
