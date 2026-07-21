import { usePage } from "@inertiajs/react";
import useDealTimeline from "../../hooks/useDealTimeline";
import DealTimelineEventList from "../timeline/DealTimelineEventList";
import DealTimelineFilters from "../timeline/DealTimelineFilters";

interface TimelineTabProps {
    dealId: number;
    dealName?: string;
    userId?: number;
}

export default function TimelineTab({
    dealId,
    dealName,
    userId,
}: TimelineTabProps) {
    const { props } = usePage<any>();
    // Editing/deleting agent-logged events is admin-only, mirroring the backend
    // gate in CrmEventController@update/@destroy (hasRole('admin')).
    const canManage = Boolean(
        props.auth?.user?.roles?.some(
            (role: { name?: string }) => role?.name === "admin",
        ),
    );

    const {
        filter,
        setFilter,
        dateRange,
        setDateRange,
        events,
        isLoading,
        isRefetching,
        refetch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useDealTimeline(dealId);

    return (
        <div className="w-full">
            <DealTimelineFilters
                dealId={dealId}
                userId={userId}
                filter={filter}
                onFilterChange={setFilter}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                isRefetching={isRefetching}
                onRefresh={() => refetch()}
            />

            <DealTimelineEventList
                events={events}
                isLoading={isLoading}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={() => fetchNextPage()}
                canManage={canManage}
                onChanged={() => refetch()}
            />
        </div>
    );
}
