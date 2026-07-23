import { useCallback, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { RecommendationsResponse } from "@/Types/api/property-recommendation";

export default function useDealRecommendations(dealId: number) {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const queryPath = route("deals.recommendations.index", { deal: dealId });

    const { data, isLoading, isError, error, refetch, isFetching } =
        useApiQuery<RecommendationsResponse>({
            path: queryPath,
            params: { limit: 10 },
            // Recommendations are expensive to compute — keep them fresh for a
            // minute so tab-switching doesn't refire the query each remount.
            options: { staleTime: 60_000 },
        });

    const recommendations = data?.recommendations ?? [];
    const cached = data?.cached ?? false;
    const apiError =
        data?.error || (isError ? (error as Error)?.message : null);
    const loading = isRefreshing || isFetching;

    const refreshRecommendations = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await axios.post(
                route("deals.recommendations.refresh", { deal: dealId }),
                { limit: 10 },
            );
            queryClient.invalidateQueries({ queryKey: [queryPath] });
        } catch (err) {
            console.error("Failed to refresh recommendations:", err);
        } finally {
            setIsRefreshing(false);
        }
    }, [dealId, queryClient, queryPath]);

    return {
        recommendations,
        cached,
        apiError,
        isLoading,
        loading,
        refetch,
        refreshRecommendations,
    };
}
