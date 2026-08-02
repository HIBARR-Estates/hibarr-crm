import { useMemo, useState } from "react";
import { useApiInfiniteQuery } from "@/lib/api/client/useApiQuery";
import type { CrmEventsIndexResponse } from "@/Types/api/crm-event";
import {
    FILTER_TO_GENERATION_TYPE,
    TimelineFilter,
    crmEventToTimelineViewModel,
} from "../adapters/timelineAdapter";

// Escaped FQCNs — CrmEventController::normalizeModelType() collapses these
// (and single-backslash forms) to App\Models\{Deal,Lead}.
export const DEAL_TIMELINE_MODEL_TYPE = "App\\\\Models\\\\Deal";
export const LEAD_TIMELINE_MODEL_TYPE = "App\\\\Models\\\\Lead";

export interface DealTimelineDateRange {
    from: string;
    to: string;
}

/**
 * CRM-event timeline for any entity. Deals pass DEAL_TIMELINE_MODEL_TYPE;
 * Leads pass LEAD_TIMELINE_MODEL_TYPE — same list/filters/infinite-scroll UI.
 */
export default function useDealTimeline(
    entityId: number,
    modelType: string = DEAL_TIMELINE_MODEL_TYPE,
) {
    const [filter, setFilter] = useState<TimelineFilter>("all");
    const [dateRange, setDateRange] = useState<DealTimelineDateRange | null>(
        null,
    );

    const queryParams = useMemo(
        () => ({
            model_type: modelType,
            model_id: entityId,
            per_page: 50,
            sort_order: "desc" as const,
            page: 1,
            ...(filter === "all"
                ? {}
                : { generation_type: FILTER_TO_GENERATION_TYPE[filter] }),
            ...(dateRange
                ? { date_from: dateRange.from, date_to: dateRange.to }
                : {}),
        }),
        [dateRange, entityId, filter, modelType],
    );

    const {
        data,
        isLoading,
        isRefetching,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useApiInfiniteQuery<CrmEventsIndexResponse>({
        path: "/api/v1/crm-events",
        params: queryParams,
        getNextPageParam: (lastPage) =>
            lastPage.meta.has_more ? lastPage.meta.current_page + 1 : undefined,
        // A filter/date-range change is a new query key — keep the current
        // events on screen while the new set loads instead of flashing empty.
        keepPreviousPageData: true,
        options: {
            // refetchInterval: 15000,
            staleTime: 1000 * 60 * 5, // 5 minutes
        },
    });

    const events = useMemo(
        () =>
            (data?.pages ?? [])
                .flatMap((page) => page.data ?? [])
                .map(crmEventToTimelineViewModel),
        [data],
    );

    const clearDateRange = () => setDateRange(null);

    return {
        filter,
        setFilter,
        dateRange,
        setDateRange,
        clearDateRange,
        events,
        isLoading,
        isRefetching,
        refetch,
        fetchNextPage,
        hasNextPage: Boolean(hasNextPage),
        isFetchingNextPage,
    };
}
