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

interface UpdateBulletsPayload {
    bullet_points: string[] | null;
}

/**
 * Applied to the owning workspace list after a successful mutation, so the
 * tab updates in place — no Inertia reload (see DealWorkspaceContext). The
 * controllers answer with the serialized insight, and the caller spreads it
 * over the stored row.
 */
export type SallyInsightPatch = (
    insightId: number,
    data: Partial<SallyMeetingInsight>,
) => void;

/**
 * The Sally summary and key points are fields the CRM owns: Sally writes a
 * first version, the team corrects it. Mutations patch the local list so the
 * tab updates in place — no Inertia reload (see DealWorkspaceContext).
 *
 * Per-insight by design: the route is `/sally-insights/{insight}`, so the id
 * has to be bound at hook time. Call it from the card, not the panel.
 * Suggested notes have their own hook (useSallySuggestionMutations), mounted
 * per item, because their routes also carry the suggestion id.
 */
export default function useSallyInsightMutations(
    insightId: number,
    patch: SallyInsightPatch,
) {
    const { t } = useTranslation();

    // The lead route is deal-agnostic (an insight is reachable from its lead
    // or from its deal), so it is the one both workspaces use.
    const { mutate: updateMutate, status: updateStatus } = useApiMutate<
        UpdateSummaryPayload,
        Partial<SallyMeetingInsight>,
        ApiResponse<Partial<SallyMeetingInsight>>
    >(route("sally-insights.update", { insight: insightId }), "PATCH");

    const { mutate: bulletsMutate, status: bulletsStatus } = useApiMutate<
        UpdateBulletsPayload,
        Partial<SallyMeetingInsight>,
        ApiResponse<Partial<SallyMeetingInsight>>
    >(route("sally-insights.update", { insight: insightId }), "PATCH");

    const applyResponse = useCallback(
        (response: ApiResponse<Partial<SallyMeetingInsight>>, fallback: Partial<SallyMeetingInsight>) => {
            if (response?.status === "success") {
                message.success(t("pages.deals.sally.messages.updated"));
                patch(insightId, {
                    ...(response.data ?? fallback),
                    id: insightId,
                });
                return true;
            }

            // A validation/permission failure comes back as a resolved
            // response, not a thrown error, so it has to be handled here or
            // an editor would close on a save that never happened.
            message.error(t("pages.deals.sally.messages.update_failed"));
            return false;
        },
        [insightId, patch, t],
    );

    const onFailed = useCallback(() => {
        message.error(t("pages.deals.sally.messages.update_failed"));
    }, [t]);

    /**
     * `onSaved` fires only once the server has accepted the value, so the
     * caller can keep the editor open (with the user's text intact) for the
     * whole request and through any failure.
     */
    const updateSummary = useCallback(
        (summary: string | null, onSaved?: () => void) => {
            if (!insightId) return;
            updateMutate(
                { summary },
                {
                    suppressSuccessToast: true,
                    onSuccess: (response) => {
                        if (applyResponse(response, { summary })) {
                            onSaved?.();
                        }
                    },
                    onError: onFailed,
                },
            );
        },
        [updateMutate, insightId, applyResponse, onFailed],
    );

    const updateBulletPoints = useCallback(
        (bulletPoints: string[] | null, onSaved?: () => void) => {
            if (!insightId) return;
            bulletsMutate(
                { bullet_points: bulletPoints },
                {
                    suppressSuccessToast: true,
                    onSuccess: (response) => {
                        if (applyResponse(response, { bullet_points: bulletPoints ?? [] })) {
                            onSaved?.();
                        }
                    },
                    onError: onFailed,
                },
            );
        },
        [bulletsMutate, insightId, applyResponse, onFailed],
    );

    return {
        updateSummary,
        updateBulletPoints,
        isUpdating: isLoading({ status: updateStatus }) || isLoading({ status: bulletsStatus }),
    };
}
