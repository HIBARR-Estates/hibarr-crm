import { useCallback } from "react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import type { SallyMeetingInsight } from "@/Types/api/sally-meeting-insight";
import type { SallyInsightPatch } from "@/Components/Redesign/sally/useSallyInsightMutations";

interface UpdateSuggestionPayload {
    text: string;
}

interface LogSuggestionPayload {
    text?: string;
}

/**
 * Mutations for one of Sally's suggested notes. Mounted per item (the routes
 * carry both the insight and the suggestion id), so it lives in the card's
 * item component, not in the panel.
 *
 * Saving rewrites the working copy and marks it agent-edited, which also
 * protects it from being overwritten by a later OL re-sync. Logging turns the
 * suggestion into a normal CRM note; pass `text` when the agent edited the
 * wording first (the server then records the "after edit" mode), omit it to
 * log Sally's text verbatim.
 */
export default function useSallySuggestionMutations(
    insightId: number,
    suggestionId: string,
    patch: SallyInsightPatch,
) {
    const { t } = useTranslation();

    const { mutate: saveMutate, status: saveStatus } = useApiMutate<
        UpdateSuggestionPayload,
        Partial<SallyMeetingInsight>,
        ApiResponse<Partial<SallyMeetingInsight>>
    >(
        route("sally-insights.suggestions.update", {
            insight: insightId,
            suggestionId,
        }),
        "PATCH",
    );

    const { mutate: logMutate, status: logStatus } = useApiMutate<
        LogSuggestionPayload,
        Partial<SallyMeetingInsight>,
        ApiResponse<Partial<SallyMeetingInsight>>
    >(
        route("sally-insights.suggestions.log", {
            insight: insightId,
            suggestionId,
        }),
        "POST",
    );

    /** Both routes answer with the serialized insight — spread it in place. */
    const applyResponse = useCallback(
        (
            response: ApiResponse<Partial<SallyMeetingInsight>>,
            successMessage: string,
        ): boolean => {
            if (response?.status === "success" && response.data) {
                message.success(successMessage);
                patch(insightId, { ...response.data, id: insightId });
                return true;
            }

            return false;
        },
        [insightId, patch],
    );

    /** A logged suggestion can only be logged once — surface the server's say-so. */
    const onFailed = useCallback(() => {
        message.error(t("pages.deals.sally.messages.suggestion_failed"));
    }, [t]);

    const saveSuggestion = useCallback(
        (text: string, onSaved?: () => void) => {
            saveMutate(
                { text },
                {
                    suppressSuccessToast: true,
                    onSuccess: (response) => {
                        if (applyResponse(response, t("pages.deals.sally.messages.suggestion_saved"))) {
                            onSaved?.();
                        }
                    },
                    onError: onFailed,
                },
            );
        },
        [saveMutate, applyResponse, onFailed, t],
    );

    const logSuggestion = useCallback(
        (text: string | null, onSaved?: () => void) => {
            logMutate(
                // Omitting the text logs Sally's wording verbatim ("as is");
                // sending it records the agent's version ("after edit").
                text === null ? {} : { text },
                {
                    suppressSuccessToast: true,
                    onSuccess: (response) => {
                        if (applyResponse(response, t("pages.deals.sally.messages.note_added"))) {
                            onSaved?.();
                        }
                    },
                    onError: onFailed,
                },
            );
        },
        [logMutate, applyResponse, onFailed, t],
    );

    return {
        saveSuggestion,
        logSuggestion,
        isSaving: isLoading({ status: saveStatus }),
        isLogging: isLoading({ status: logStatus }),
    };
}
